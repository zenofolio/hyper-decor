import { singleton, injectable } from "tsyringe";
import { IMessageTransport, IMessageOptions, IMessageEmitOptions } from "../transport";
import type { NatsConnection, Codec, Msg, Subscription, ConnectionOptions, PublishOptions } from "nats";

@injectable()
export class NatsTransport implements IMessageTransport {
  readonly name = "nats";
  private connection: NatsConnection | null = null;
  private codec: Codec<any> | null = null;
  private subscriptions: Subscription[] = [];
  private options: ConnectionOptions;

  private connectionPromise: Promise<NatsConnection> | null = null;

  constructor(options?: ConnectionOptions) {
    this.options = options || { servers: "nats://localhost:4222" };
  }

  private async getConnection(): Promise<NatsConnection> {
    if (this.connection) return this.connection;
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = (async () => {
      try {
        const { connect, JSONCodec } = await import("nats");
        this.connection = await connect(this.options);
        this.codec = JSONCodec();
        
        // Handle unexpected closures
        this.connection.closed().then((err: any) => {
          if (err) console.error(`[NatsTransport] Connection closed with error:`, err);
          this.connection = null;
          this.connectionPromise = null;
        });

        return this.connection;
      } catch (error) {
        this.connectionPromise = null;
        throw new Error(
          "NATS dependency is missing or connection failed. Please install 'nats' package and check your config."
        );
      }
    })();

    return this.connectionPromise;
  }

  async listen(
    topic: string,
    handler: (data: any) => Promise<void> | void,
    options?: IMessageOptions
  ): Promise<void> {
    const nc = await this.getConnection();
    
    const subOptions: any = {};
    const natsOptions = options?.nats || {};
    if (options?.queue || natsOptions.queue) {
        subOptions.queue = options?.queue || natsOptions.queue;
    }

    const sub = nc.subscribe(topic, subOptions);
    this.subscriptions.push(sub);

    (async () => {
      for await (const m of sub) {
        try {
          const data = this.codec?.decode(m.data);
          const result = handler(data);
          if (result instanceof Promise) await result;
        } catch (err) {
          console.error(`[NatsTransport] Error handling message on topic ${topic}:`, err);
        }
      }
    })();
  }

  async emit(topic: string, data: any, options?: PublishOptions): Promise<void> {
    const nc = await this.getConnection();
    const payload = this.codec?.encode(data);
    if (payload) nc.publish(topic, payload, options);
  }

  async close() {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }
}
