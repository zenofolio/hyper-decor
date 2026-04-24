import { container, singleton, injectable } from "tsyringe";
import { IMessageTransport } from "./transport";

@singleton()
@injectable()
export class MessageBus {
  private transports: IMessageTransport[] = [];

  registerTransport(transport: IMessageTransport) {
    this.transports.push(transport);
  }

  async emit(topic: string, data: any, options?: any): Promise<void> {
    const targets = options?.transport
      ? this.transports.filter((t) => t.name === options.transport)
      : this.transports;

    await Promise.all(targets.map((t) => t.emit(topic, data, options)));
  }

  async listen(
    topic: string,
    handler: (data: any) => Promise<void> | void,
    options?: any
  ): Promise<void> {
    const targets = options?.transport
      ? this.transports.filter((t) => t.name === options.transport)
      : this.transports;

    await Promise.all(targets.map((t) => t.listen(topic, handler, options)));
  }

  /**
   * Static helper to emit messages without resolving the bus manually.
   */
  static async emit(topic: string, data: any, options?: any): Promise<void> {
    const bus = container.resolve(MessageBus);
    await bus.emit(topic, data, options);
  }
}
