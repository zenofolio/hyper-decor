import { singleton, injectable } from "tsyringe";
import { IMessageTransport, IMessageOptions } from "../transport";
import type { NatsConnection, Codec, Subscription, ConnectionOptions, PublishOptions } from "nats";
import { ILogger, InternalLogger } from "../logger";

export interface NatsTransportOptions extends ConnectionOptions {
  codec?: Codec<any>;
  logger?: ILogger;
}

@injectable()
export class NatsTransport implements IMessageTransport {
  readonly name = "nats";
  private connection: NatsConnection | null = null;
  private codec: Codec<any> | null = null;
  private subscriptions: Subscription[] = [];
  private options: NatsTransportOptions;

  private connectionPromise: Promise<NatsConnection> | null = null;
  private logger: ILogger;

  constructor(options?: NatsTransportOptions) {
    this.options = options || { servers: "nats://localhost:4222" };
    this.logger = options?.logger || new InternalLogger();
  }

  private async getConnection(): Promise<NatsConnection> {
    if (this.connection) return this.connection;
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = (async () => {
      try {
        const { connect, JSONCodec } = await import("nats");
        this.logger.info(`[NatsTransport] Connecting to NATS at ${JSON.stringify(this.options.servers)}`);
        this.connection = await connect(this.options);
        this.codec = this.options?.codec || JSONCodec();

        this.logger.info(`[NatsTransport] Connected to NATS`);

        // Handle unexpected closures
        this.connection.closed().then((err: any) => {
          if (err) {
            this.logger.error(`[NatsTransport] Connection closed with error:`, err);
          } else {
            this.logger.info(`[NatsTransport] Connection closed`);
          }
          this.connection = null;
          this.connectionPromise = null;
        });

        return this.connection;
      } catch (error) {
        this.connectionPromise = null;
        this.logger.error("[NatsTransport] Failed to connect to NATS", error);
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
    this.logger.info(`[NatsTransport] Subscribed to topic: ${topic}${subOptions.queue ? ` (queue: ${subOptions.queue})` : ""}`);

    (async () => {
      for await (const m of sub) {
        try {
          const data = this.codec?.decode(m.data);
          this.logger.debug(`[NatsTransport] Received message on topic: ${topic}`);
          const result = handler(data);
          if (result instanceof Promise) await result;
        } catch (err) {
          this.logger.error(`[NatsTransport] Error handling message on topic ${topic}:`, err);
        }
      }
    })();
  }

  async emit(topic: string, data: any, options?: PublishOptions): Promise<void> {
    const nc = await this.getConnection();
    const payload = this.codec?.encode(data);
    this.logger.debug(`[NatsTransport] Publishing message to topic: ${topic}`);
    if (payload) nc.publish(topic, payload, options);
  }

  async close() {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }
}
