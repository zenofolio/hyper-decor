import { singleton } from "tsyringe";
import { EventEmitter } from "eventemitter3";

export interface IMessageTransport {
  listen(topic: string, handler: (data: any) => Promise<void> | void): Promise<void>;
  emit(topic: string, data: any): Promise<void>;
}

@singleton()
export class InternalTransport implements IMessageTransport {
  private emitter = new EventEmitter();
  private wildcardHandlers: { pattern: RegExp; handler: (data: any) => Promise<void> | void }[] = [];

  async listen(topic: string, handler: (data: any) => Promise<void> | void): Promise<void> {
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

  async emit(topic: string, data: any): Promise<void> {
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
