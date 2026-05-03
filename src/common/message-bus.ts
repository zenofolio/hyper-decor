import { container, singleton, injectable } from "tsyringe";
import { IMessageTransport, Transport, IMessageEnvelope, IMessageEmitOptions, IMessageInterceptor, IMessageOptions, IMessageContract } from "./transport";
import { randomUUID } from "crypto";

@singleton()
export class MessageBus {
  private transports: IMessageTransport[] = [];
  private interceptor?: IMessageInterceptor;

  setInterceptor(interceptor: IMessageInterceptor) {
    this.interceptor = interceptor;
  }

  registerTransport(transport: IMessageTransport) {
    if (this.transports.some((t) => t.name === transport.name)) return;
    this.transports.push(transport);
  }

  async emit<T = any>(topicOrContract: string | IMessageContract<T>, data: T, options?: IMessageEmitOptions): Promise<void> {
    let topic: string;
    let payload = data;
    let mergedOptions = options;

    if (typeof topicOrContract === "string") {
      topic = topicOrContract;
    } else {
      const def = topicOrContract.getDefinition();
      topic = def.topic;
      payload = def.schema.parse(data);
    }

    const envelope: IMessageEnvelope = {
      i: randomUUID(),
      c: mergedOptions?.correlationId,
      t: Date.now(),
      m: payload
    };

    const targets = mergedOptions?.transport
      ? this.transports.filter((t) => t.name === mergedOptions.transport)
      : this.transports;

    if (this.interceptor?.onEmit) {
      await this.interceptor.onEmit(topic, envelope, mergedOptions || {});
    }

    await Promise.all(targets.map((t) => t.emit(topic, envelope, mergedOptions)));
  }

  /**
   * Emits a message only to the local (internal) transport for maximum performance.
   */
  async emitLocal(topic: string, data: any, options?: IMessageEmitOptions): Promise<void> {
    await this.emit(topic, data, { ...options, transport: Transport.INTERNAL });
  }

  async listen<T = any>(
    topicOrContract: string | IMessageContract<T>,
    handler: (data: T, envelope?: IMessageEnvelope) => Promise<void> | void,
    options?: IMessageOptions
  ): Promise<void> {
    let topic: string;
    let subOptions: IMessageOptions = { ...options };

    if (typeof topicOrContract === "string") {
      topic = topicOrContract;
    } else {
      const def = topicOrContract.getDefinition();
      topic = def.topic;
      subOptions = { ...def.config, ...subOptions };
    }

    const targets = subOptions.transport
      ? this.transports.filter((t) => t.name === subOptions.transport)
      : this.transports;

    if (!subOptions.subscriptionId) {
      subOptions.subscriptionId = randomUUID();
    }

    const wrappedHandler = async (incoming: any) => {
      // Defensive unwrapping
      if (incoming && typeof incoming === 'object' && 'i' in incoming && 'm' in incoming) {
        const envelope = incoming as IMessageEnvelope;

        // Interceptor check
        if (this.interceptor?.onReceive) {
          const proceed = await this.interceptor.onReceive(topic, envelope, subOptions);
          if (proceed === false) return; // Silent discard
        }

        await handler(envelope.m, envelope);
      } else {
        // Direct delivery for non-envelope messages (external compatibility)
        await handler(incoming);
      }
    };

    await Promise.all(
      targets.map((t) => t.listen(topic, wrappedHandler, subOptions))
    );
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
