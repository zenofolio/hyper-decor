import { EventEmitter } from "eventemitter3";

export interface IMessageTransport {
  listen(topic: string, handler: (data: any) => Promise<void> | void): Promise<void>;
  emit(topic: string, data: any): Promise<void>;
}

export class InternalTransport implements IMessageTransport {
  private emitter = new EventEmitter();

  async listen(topic: string, handler: (data: any) => Promise<void> | void): Promise<void> {
    if (topic.includes("*")) {
      const patternString = topic
        .replace(/[+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\./g, "\\.")
        .replace(/\*/g, ".*");
      const pattern = new RegExp(`^${patternString}$`);

      this.emitter.on("*", async (t: string, data: any) => {
        if (pattern.test(t)) await handler(data);
      });
    } else {
      this.emitter.on(topic, handler);
    }
  }

  async emit(topic: string, data: any): Promise<void> {
    this.emitter.emit(topic, data);
  }
}
