import { container, singleton } from "tsyringe";
import { IMessageTransport } from "./transport";

@singleton()
export class MessageBus {
  private transports: IMessageTransport[] = [];

  registerTransport(transport: IMessageTransport) {
    this.transports.push(transport);
  }

  async emit(topic: string, data: any): Promise<void> {
    console.log(`[MessageBus] EMIT: ${topic}`, data);
    await Promise.all(this.transports.map((t) => t.emit(topic, data)));
  }

  async listen(topic: string, handler: (data: any) => Promise<void> | void): Promise<void> {
    console.log(`[MessageBus] LISTEN: ${topic}`);
    await Promise.all(this.transports.map((t) => t.listen(topic, handler)));
  }

  /**
   * Static helper to emit messages without resolving the bus manually.
   */
  static async emit(topic: string, data: any): Promise<void> {
    const bus = container.resolve(MessageBus);
    await bus.emit(topic, data);
  }
}
