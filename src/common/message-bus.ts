import { container, singleton, injectable } from "tsyringe";
import { IMessageTransport, Transport, IMessageEnvelope, IMessageEmitOptions, IMessageInterceptor, IMessageOptions } from "./transport";
import { randomUUID } from "crypto";

@singleton()
@injectable()
export class MessageBus {
  private transports: IMessageTransport[] = [];
  private interceptor?: IMessageInterceptor;

  setInterceptor(interceptor: IMessageInterceptor) {
    this.interceptor = interceptor;
  }

  registerTransport(transport: IMessageTransport) {
    this.transports.push(transport);
  }

  async emit(topic: string, data: any, options?: IMessageEmitOptions): Promise<void> {
    const envelope: IMessageEnvelope = {
      i: randomUUID(),
      c: options?.correlationId,
      t: Date.now(),
      m: data
    };

    const targets = options?.transport
      ? this.transports.filter((t) => t.name === options.transport)
      : this.transports;

    if (this.interceptor?.onEmit) {
      await this.interceptor.onEmit(topic, envelope, options || {});
    }

    await Promise.all(targets.map((t) => t.emit(topic, envelope, options)));
  }

  /**
   * Emits a message only to the local (internal) transport for maximum performance.
   */
  async emitLocal(topic: string, data: any, options?: IMessageEmitOptions): Promise<void> {
    await this.emit(topic, data, { ...options, transport: Transport.INTERNAL });
  }

  async listen(
    topic: string,
    handler: (data: any, envelope?: IMessageEnvelope) => Promise<void> | void,
    options?: any
  ): Promise<void> {
    const targets = options?.transport
      ? this.transports.filter((t) => t.name === options.transport)
      : this.transports;

    const wrappedHandler = async (incoming: any) => {
      // Defensive unwrapping
      if (incoming && typeof incoming === 'object' && 'i' in incoming && 'm' in incoming) {
        const envelope = incoming as IMessageEnvelope;

        // Interceptor check
        if (this.interceptor?.onReceive) {
          const proceed = await this.interceptor.onReceive(topic, envelope, options || {});
          if (proceed === false) return; // Silent discard
        }

        await handler(envelope.m, envelope);
      } else {
        // Direct delivery for non-envelope messages (external compatibility)
        await handler(incoming);
      }
    };

    await Promise.all(targets.map((t) => {
      t.listen(topic, wrappedHandler, options)
    }));
  }

  /**
   * Static helper to emit messages without resolving the bus manually.
   */
  static async emit(topic: string, data: any, options?: any): Promise<void> {
    const bus = container.resolve(MessageBus);
    await bus.emit(topic, data, options);
  }

  /**
   * Static helper to emit messages locally without resolving the bus manually.
   */
  static async emitLocal(topic: string, data: any, options?: any): Promise<void> {
    const bus = container.resolve(MessageBus);
    await bus.emitLocal(topic, data, options);
  }
}
