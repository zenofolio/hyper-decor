import { EventEmitter } from "eventemitter3";

export interface IMessageTransport {
  listen(topic: string, handler: (data: any) => Promise<void> | void): Promise<void>;
  emit(topic: string, data: any): Promise<void>;
}

export class InternalTransport implements IMessageTransport {
  private emitter = new EventEmitter();

  async listen(topic: string, handler: (data: any) => Promise<void> | void): Promise<void> {
    // Basic wildcard support: user.* -> user.created, user.updated
    // We'll use a simple regex for this internal transport
    if (topic.includes("*")) {
      const pattern = new RegExp("^" + topic.replace(/\*/g, ".*") + "$");
      
      // We need a catch-all for wildcards in EventEmitter3? 
      // EE3 doesn't support wildcards out of the box easily without listening to all events.
      // For this internal implementation, we'll override emit or use a proxy.
      // But simpler: just use a pattern-matching listener.
      this.emitter.on("message", (t: string, data: any) => {
        if (pattern.test(t)) {
          handler(data);
        }
      });
    } else {
      this.emitter.on(topic, handler);
    }
  }

  async emit(topic: string, data: any): Promise<void> {
    this.emitter.emit(topic, data);
    this.emitter.emit("message", topic, data); // For wildcard listeners
  }
}
