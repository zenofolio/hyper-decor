import { singleton, inject } from "tsyringe";
import { EventEmitter } from "eventemitter3";
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
  listen(topic: string, handler: (data: any) => Promise<void> | void, options?: IMessageOptions): Promise<void>;
  emit(topic: string, data: any, options?: IMessageEmitOptions): Promise<void>;
}

@singleton()
export class InternalTransport implements IMessageTransport {
  readonly name = "internal";
  private emitter = new EventEmitter();
  private wildcardHandlers: { pattern: RegExp; handler: (data: any) => Promise<void> | void }[] = [];
  private logger: ILogger;

  constructor(@inject(LOGGER_TOKEN) logger?: any) {
    this.logger = logger || new InternalLogger();
  }

  async listen(topic: string, handler: (data: any) => Promise<void> | void, options?: IMessageOptions): Promise<void> {
    this.logger.debug(`[InternalTransport] Listening on topic: ${topic}`);
    if (topic.includes("*")) {
      const patternString = topic
        .replace(/[+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\./g, "\\.")
        .replace(/\*/g, ".*");
      this.wildcardHandlers.push({
        pattern: new RegExp(`^${patternString}$`),
        handler,
      });
    } else {
      this.emitter.on(topic, handler);
    }
  }

  async emit(topic: string, data: any, options?: IMessageEmitOptions): Promise<void> {
    this.logger.debug(`[InternalTransport] Emitting on topic: ${topic}`);
    // 1. Regular emit
    this.emitter.emit(topic, data);

    // 2. Wildcard checks
    for (const item of this.wildcardHandlers) {
      if (item.pattern.test(topic)) {
        await item.handler(data);
      }
    }
  }
}
