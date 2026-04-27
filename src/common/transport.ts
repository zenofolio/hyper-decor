import { inject, injectable } from "tsyringe";
import { ILogger, InternalLogger, LOGGER_TOKEN } from "./logger";

export enum Transport {
  INTERNAL = "internal",
  NATS = "nats",
  REDIS = "redis",
}

export interface IMessageOptions {
  concurrency?: number;
  transport?: Transport | string;
  idempotency?: boolean | { ttl: number };
  subscriptionId?: string; // Internal use for idempotency keys
  [key: string]: any;
}

export interface IMessageEmitOptions {
  transport?: Transport | string;
  correlationId?: string;
  [key: string]: any;
}

/**
 * 📦 Message Envelope
 * Standard wrapper for all messages to provide tracing and idempotency.
 */
export interface IMessageEnvelope<T = any> {
  i: string;  // Message ID
  c?: string; // Correlation ID
  t: number;  // Timestamp
  m: T;       // Payload
}

/**
 * 🛡️ Message Interceptor
 * Allows global control over message emission and reception.
 */
export interface IMessageInterceptor {
  /** Runs before sending to transports. Can modify the envelope or options. */
  onEmit?(topic: string, envelope: IMessageEnvelope, options: IMessageEmitOptions): Promise<void>;

  /** Runs when a message arrives. Return false to cancel delivery to the handler. */
  onReceive?(topic: string, envelope: IMessageEnvelope, options: IMessageOptions): Promise<boolean>;
}

export interface IMessageTransport {
  readonly name: string;
  listen(topic: string, handler: (data: any) => Promise<any> | void, options?: IMessageOptions): Promise<any>;
  emit(topic: string, data: any, options?: IMessageEmitOptions): Promise<void>;
  isConnected(): Promise<boolean>;
  close(): Promise<void>;
  onInit?(): Promise<any>;
  setLogger(logger: ILogger): void;
}

export interface IInternalTransportOptions {
  maxCacheSize?: number;
  logger?: ILogger;
}

type Handler = (data: any) => void | Promise<any>;

interface ITrieNode {
  children: Map<number, ITrieNode>;
  star?: ITrieNode;
  greater?: ITrieNode;
  handlers: Handler[];
}

@injectable()
export class InternalTransport implements IMessageTransport {
  readonly name = Transport.INTERNAL;
  private logger: ILogger;

  // --- Object-based Trie ---
  private root: ITrieNode = this.createNode();

  // --- Two-Map LRU Cache (Fastest in V8) ---
  private cacheActive: Map<string, Handler[]> = new Map();
  private cacheOld: Map<string, Handler[]> = new Map();
  private readonly maxCacheSize: number;

  constructor(
    @inject(LOGGER_TOKEN) logger?: ILogger,
  ) {
    this.logger = logger || new InternalLogger();
    this.maxCacheSize = 2500;
  }

  setLogger(logger: ILogger): void {
    this.logger = logger;
  }

  onInit(): Promise<any> {
    return Promise.resolve();
  }

  private createNode(): ITrieNode {
    return {
      children: new Map(),
      handlers: []
    };
  }

  private hash(str: string): number {
    let h = 0 | 0;
    const len = str.length;
    for (let i = 0; i < len; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h >>> 0;
  }

  private hashRange(str: string, start: number, end: number): number {
    let h = 0 | 0;
    for (let i = start; i < end; i++) {
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
    // Invalidate caches on new subscription
    this.cacheActive = new Map();
    this.cacheOld = new Map();

    const paths = this.precompute(topic);
    for (const segments of paths) {
      this.addSubscription(this.root, segments, 0, handler);
    }
  }

  private addSubscription(node: ITrieNode, segments: string[], sIdx: number, handler: Handler) {
    if (sIdx === segments.length) {
      node.handlers.push(handler);
      return;
    }

    const segment = segments[sIdx];

    if (segment === '*') {
      if (!node.star) node.star = this.createNode();
      this.addSubscription(node.star, segments, sIdx + 1, handler);
    } else if (segment === '>') {
      if (!node.greater) node.greater = this.createNode();
      this.addSubscription(node.greater, segments, sIdx + 1, handler);
    } else {
      const h = this.hash(segment);
      let next = node.children.get(h);
      if (!next) {
        next = this.createNode();
        node.children.set(h, next);
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
    let handlers = this.cacheActive.get(topic);
    if (handlers !== undefined) return handlers;

    handlers = this.cacheOld.get(topic);
    if (handlers !== undefined) {
      this.updateCache(topic, handlers);
      return handlers;
    }

    const results: Handler[] = [];
    this.recursiveSearch(this.root, topic, 0, results);

    this.updateCache(topic, results);
    return results;
  }

  private updateCache(topic: string, handlers: Handler[]) {
    this.cacheActive.set(topic, handlers);
    if (this.cacheActive.size >= this.maxCacheSize) {
      this.cacheOld = this.cacheActive;
      this.cacheActive = new Map();
    }
  }

  private recursiveSearch(node: ITrieNode, topic: string, start: number, results: Handler[]) {
    const len = topic.length;

    if (start > len) {
      if (node.handlers.length > 0) results.push(...node.handlers);
      return;
    }

    if (node.greater && start < len) {
      results.push(...node.greater.handlers);
    }

    if (start <= len) {
      let end = topic.indexOf('.', start);
      if (end === -1) end = len;

      const h = this.hashRange(topic, start, end);
      const next = node.children.get(h);
      if (next) {
        this.recursiveSearch(next, topic, end + 1, results);
      }

      if (node.star) {
        this.recursiveSearch(node.star, topic, end + 1, results);
      }

      if (end === len) {
        if (node.handlers.length > 0) results.push(...node.handlers);
      }
    }
  }

  async isConnected(): Promise<boolean> { return true; }
  async connect(): Promise<void> { return Promise.resolve(); }
  async close(): Promise<void> {
    this.cacheActive.clear();
    this.cacheOld.clear();
    return Promise.resolve();
  }

  __getCacheSize() {
    return this.cacheActive.size + this.cacheOld.size;
  }
}
