import { IMessageTransport, IMessageOptions, IMessageEmitOptions } from "../../common/transport";
import type {
  NatsConnection,
  Codec,
  Subscription,
  ConnectionOptions,
  JetStreamClient,
  JetStreamManager,
  StreamConfig,
  ConsumerConfig,
  JetStreamSubscription,
} from "nats";

export interface NatsTransportOptions extends ConnectionOptions {
  codec?: Codec<any>;
  logger?: ILogger;
  jetstream?: boolean; // Enable JetStream by default if true
}

import { SetMessageMetadata } from "../../lib/server/decorators/Messaging";
import { ILogger, InternalLogger } from "../../common/logger";
import { singleton } from "tsyringe";

export interface NatsMessageOptions extends IMessageOptions {
  queue?: string;
  jetstream?: {
    stream?: string;
    consumer?: string;
    streamConfig?: Partial<StreamConfig>;
    consumerConfig?: Partial<ConsumerConfig>;
    pull?: boolean;
  };
  nats?: any;
}

/**
 * Decorator to specify NATS-specific options for a message handler.
 */
export const OnNatsOptions = (options: Partial<NatsMessageOptions>) =>
  SetMessageMetadata("nats", options);


@singleton()
export class NatsTransport implements IMessageTransport {
  readonly name = "nats";
  private connection: NatsConnection | null = null;
  private codec: Codec<any> | null = null;
  private js: JetStreamClient | null = null;
  private jsm: JetStreamManager | null = null;
  private subscriptions: (Subscription | JetStreamSubscription)[] = [];
  private options: NatsTransportOptions;

  private connectionPromise: Promise<NatsConnection> | null = null;


  constructor(
    options?: NatsTransportOptions,
    private logger?: ILogger
  ) {
    this.options = options || { servers: "nats://localhost:4222" };
    this.logger = logger || options?.logger || new InternalLogger();
  }

  setLogger(logger: ILogger): void {
    this.logger = logger;
  }


  async getClient(): Promise<NatsConnection> {
    return await this.onInit()
  }

  private async ensureJetStream() {
    if (this.js && this.jsm) return { js: this.js, jsm: this.jsm };
    const nc = await this.getClient();
    this.js = nc.jetstream();
    this.jsm = await nc.jetstreamManager();
    return { js: this.js, jsm: this.jsm };
  }

  async listen(
    topic: string,
    handler: (data: any) => Promise<any> | void,
    options?: NatsMessageOptions
  ): Promise<any> {
    const nc = await this.getClient();

    // Extract NATS specific options if they exist
    const natsOptions = options?.nats || options;
    const jsOptions = natsOptions?.jetstream;
    const queue = natsOptions?.queue;

    if (jsOptions) {
      const { js, jsm } = await this.ensureJetStream();

      // 1. Upsert Stream
      if (jsOptions.stream || jsOptions.streamConfig) {
        const streamName = jsOptions.stream || jsOptions.streamConfig?.name;
        if (streamName) {
          const config = { name: streamName, subjects: [topic], ...jsOptions.streamConfig } as StreamConfig;
          try {
            await jsm.streams.add(config);
            this.logger?.info(`[NatsTransport] Stream ${streamName} upserted`);
          } catch (e) {
            // If exists, update
            await jsm.streams.update(streamName, config);
            this.logger?.info(`[NatsTransport] Stream ${streamName} updated`);
          }
        }
      }

      // 2. Upsert Consumer
      if (jsOptions.consumer || jsOptions.consumerConfig) {
        const streamName = jsOptions.stream || jsOptions.streamConfig?.name;
        if (streamName) {
          const consumerName = jsOptions.consumer || jsOptions.consumerConfig?.durable_name;
          const config = { durable_name: consumerName, ...jsOptions.consumerConfig } as ConsumerConfig;
          await jsm.consumers.add(streamName, config);
          this.logger?.info(`[NatsTransport] Consumer ${consumerName} upserted on stream ${streamName}`);
        }
      }

      // 3. Subscribe
      const sub = await js.subscribe(topic, {
        queue: queue,
        ...natsOptions as any
      });
      this.subscriptions.push(sub);
      this.handleSubscription(sub, topic, handler);
      return sub;
    }

    // Standard Pub/Sub
    const sub = nc.subscribe(topic, { queue: queue });
    this.subscriptions.push(sub);
    this.handleSubscription(sub, topic, handler);
    return sub;
  }

  private async handleSubscription(sub: Subscription | JetStreamSubscription, topic: string, handler: (data: any) => Promise<any> | void) {
    for await (const m of sub) {
      try {
        const data = this.codec?.decode(m.data);
        const result = handler(data);
        if (result instanceof Promise) await result;

        // Only JetStream messages have ack()
        if ('ack' in m && typeof m.ack === 'function') {
          m.ack();
        }
      } catch (err) {
        this.logger?.error(`[NatsTransport] Error handling message on topic ${topic}:`, err);
      }
    }
  }

  async emit(topic: string, data: any, options?: IMessageEmitOptions & { jetstream?: boolean, nats?: any }): Promise<void> {
    const nc = await this.getClient();
    const payload = this.codec?.encode(data);
    if (!payload) return;

    const natsOptions = options?.nats || options;

    if (natsOptions?.jetstream || this.options.jetstream) {
      const { js } = await this.ensureJetStream();
      await js.publish(topic, payload, natsOptions as any);
      return;
    }

    nc.publish(topic, payload, natsOptions as any);
  }

  async isConnected(): Promise<boolean> {
    return this.connection !== null && !this.connection.isClosed();
  }


  async close() {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  async onInit(): Promise<any> {
    if (this.connection) return this.connection;
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = (async () => {
      try {
        const { connect, JSONCodec } = await import("nats");
        this.logger?.info(`[NatsTransport] Connecting to NATS at ${JSON.stringify(this.options.servers)}`);
        this.connection = await connect(this.options);
        this.codec = this.options?.codec || JSONCodec();

        this.logger?.info(`[NatsTransport] Connected to NATS`);

        if (this.options.jetstream) {
          this.js = this.connection.jetstream();
          this.jsm = await this.connection.jetstreamManager();
        }

        this.connection.closed().then((err: any) => {
          if (err) this.logger?.error(`[NatsTransport] Connection closed with error:`, err);
          else this.logger?.info(`[NatsTransport] Connection closed`);
          this.connection = null;
          this.connectionPromise = null;
          this.js = null;
          this.jsm = null;
        });

        return this.connection;
      } catch (error) {
        this.connectionPromise = null;
        this.logger?.error("[NatsTransport] Failed to connect to NATS", error);
        throw new Error("NATS dependency is missing or connection failed.");
      }
    })();

    return this.connectionPromise;
  }
}
