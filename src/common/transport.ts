import { singleton, inject, injectable } from "tsyringe";
import { ILogger, InternalLogger, LOGGER_TOKEN } from "./logger";

export interface IMessageOptions {
  concurrency?: number;
  transport?: string;
  [key: string]: any;
}

export interface IMessageEmitOptions {
  transport?: string;
  [key: string]: any;
}

export interface IMessageTransport {
  readonly name: string;
  listen(topic: string, handler: (data: any) => Promise<any> | void, options?: IMessageOptions): Promise<any>;
  emit(topic: string, data: any, options?: IMessageEmitOptions): Promise<void>;
  isConnected(): Promise<boolean>;
  connect(): Promise<void>;
  close(): Promise<void>;
  onInit?(): Promise<any>;
}

export interface IInternalTransportOptions {
  cacheSize?: number;
  initialCapacity?: number;
  logger?: ILogger;
}

type Handler = (data: any) => void | Promise<any>;

@injectable()
@singleton()
export class InternalTransport implements IMessageTransport {
  readonly name = "internal";
  private logger: ILogger;

  // --- High-Performance Router State (Arena + Trie) ---
  private arena: Uint32Array;
  private childMaps: Map<string, number>[] = [];
  private handlersList: Handler[][] = [];
  private nodeCount = 0;
  private readonly root = 0;

  // --- Configurable Direct-Mapped Cache ---
  private readonly cacheSize: number;
  private readonly cacheMask: number;
  private cacheTags: Uint32Array;
  private cacheValues: Int32Array;
  private cacheTopics: string[];
  private cacheResults: Handler[][];

  constructor(
    @inject(LOGGER_TOKEN) logger?: any,
    options: IInternalTransportOptions = {}
  ) {
    this.logger = logger || options.logger || new InternalLogger();

    // Configure Cache Size (Must be power of 2)
    const requestedCacheSize = options.cacheSize || 4096;
    this.cacheSize = Math.pow(2, Math.ceil(Math.log2(requestedCacheSize)));
    this.cacheMask = this.cacheSize - 1;

    this.cacheTags = new Uint32Array(this.cacheSize);
    this.cacheValues = new Int32Array(this.cacheSize).fill(-1);
    this.cacheTopics = new Array<string>(this.cacheSize);
    this.cacheResults = new Array<Handler[]>(this.cacheSize);

    // Initialize Arena
    const initialCapacity = options.initialCapacity || 10000;
    this.arena = new Uint32Array(initialCapacity * 4);
    
    // @ts-expect-error
    this.root = this.createNode();
  }

  private createNode(): number {
    const id = this.nodeCount++;
    const base = id * 4;

    if (base + 4 > this.arena.length) {
      const newArena = new Uint32Array(this.arena.length * 2);
      newArena.set(this.arena);
      this.arena = newArena;
    }

    this.arena[base] = this.childMaps.length;
    this.arena[base + 1] = 4294967295;
    this.arena[base + 2] = 4294967295;
    this.arena[base + 3] = this.handlersList.length;

    this.childMaps.push(new Map());
    this.handlersList.push([]);
    return id;
  }

  /**
   * Fast 32-bit Hash (FxHash / Java String style)
   */
  private hash(str: string): number {
    let h = 0 | 0;
    const len = str.length;
    for (let i = 0; i < len; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h >>> 0;
  }

  private precompute(topic: string): string[][] {
    const segments = topic.split('.');
    let paths: string[][] = [[]];

    for (const segment of segments) {
      if (segment.startsWith('{') && segment.endsWith('}')) {
        const choices = segment.slice(1, -1).split('|');
        const newPaths: string[][] = [];
        for (const choice of choices) {
          for (const path of paths) {
            newPaths.push([...path, choice]);
          }
        }
        paths = newPaths;
      } else {
        for (const path of paths) {
          path.push(segment);
        }
      }
    }
    return paths;
  }

  async listen(topic: string, handler: (data: any) => Promise<any> | void, options?: IMessageOptions): Promise<any> {
    // Invalidate cache
    this.cacheValues.fill(-1);

    const paths = this.precompute(topic);
    for (const segments of paths) {
      this.addSubscription(this.root, segments, 0, handler);
    }
  }

  private addSubscription(nodeIdx: number, segments: string[], sIdx: number, handler: Handler) {
    if (sIdx === segments.length) {
      this.handlersList[this.arena[nodeIdx * 4 + 3]].push(handler);
      return;
    }

    const segment = segments[sIdx];
    const base = nodeIdx * 4;

    if (segment === '*') {
      if (this.arena[base + 1] === 4294967295) this.arena[base + 1] = this.createNode();
      this.addSubscription(this.arena[base + 1], segments, sIdx + 1, handler);
    } else if (segment === '>') {
      if (this.arena[base + 2] === 4294967295) this.arena[base + 2] = this.createNode();
      this.addSubscription(this.arena[base + 2], segments, sIdx + 1, handler);
    } else {
      const childMap = this.childMaps[this.arena[base]];
      let next = childMap.get(segment);
      if (next === undefined) {
        next = this.createNode();
        childMap.set(segment, next);
      }
      this.addSubscription(next, segments, sIdx + 1, handler);
    }
  }

  emit(topic: string, data: any, options?: IMessageEmitOptions): Promise<void> {
    const handlers = this.match(topic);
    const len = handlers.length;
    if (len === 0) return Promise.resolve();

    if (len === 1) {
      const res = handlers[0](data);
      if (res instanceof Promise) return res;
      return Promise.resolve();
    }

    const promises: Promise<any>[] = [];
    for (let i = 0; i < len; i++) {
      const res = handlers[i](data);
      if (res instanceof Promise) promises.push(res);
    }

    if (promises.length > 0) return Promise.all(promises) as any;
    return Promise.resolve();
  }

  private match(topic: string): Handler[] {
    const h = this.hash(topic);
    const idx = h & this.cacheMask;

    if (this.cacheValues[idx] !== -1 && this.cacheTags[idx] === h && this.cacheTopics[idx] === topic) {
      return this.cacheResults[idx];
    }

    const segments = topic.split('.');
    const results: Handler[] = [];
    this.recursiveSearch(this.root, segments, 0, results);

    this.cacheTags[idx] = h;
    this.cacheTopics[idx] = topic;
    this.cacheValues[idx] = 1;
    this.cacheResults[idx] = results;

    return results;
  }

  private recursiveSearch(nodeIdx: number, segments: string[], sIdx: number, results: Handler[]) {
    const base = nodeIdx * 4;

    if (sIdx === segments.length) {
      const handlers = this.handlersList[this.arena[base + 3]];
      if (handlers.length > 0) results.push(...handlers);
    }

    const greaterIdx = this.arena[base + 2];
    if (greaterIdx !== 4294967295) {
      results.push(...this.handlersList[this.arena[greaterIdx * 4 + 3]]);
    }

    if (sIdx < segments.length) {
      const segment = segments[sIdx];
      const nextIdx = this.childMaps[this.arena[base]].get(segment);
      if (nextIdx !== undefined) {
        this.recursiveSearch(nextIdx, segments, sIdx + 1, results);
      }
      const starIdx = this.arena[base + 1];
      if (starIdx !== 4294967295) {
        this.recursiveSearch(starIdx, segments, sIdx + 1, results);
      }
    }
  }

  async isConnected(): Promise<boolean> {
    return true;
  }

  async connect(): Promise<void> {
    return Promise.resolve();
  }

  async close(): Promise<void> {
    this.cacheValues.fill(-1);
    this.cacheTopics.fill("");
    this.cacheResults.fill([]);
    return Promise.resolve();
  }
}
