import { IMessageTransport, IMessageOptions, IMessageEmitOptions } from "../../common/transport";
import type { Redis, RedisOptions } from "ioredis";

import { SetMessageMetadata } from "../../lib/server/decorators/Messaging";
import { ILogger, InternalLogger } from "../../common/logger";

export interface RedisMessageOptions extends IMessageOptions {
  stream?: {
    group?: string;
    consumer?: string;
    mkstream?: boolean;
    readPending?: boolean;
  };
  redis?: any;
}

/**
 * Decorator to specify Redis-specific options for a message handler.
 */
export const OnRedisOptions = (options: Partial<RedisMessageOptions>) =>
  SetMessageMetadata("redis", options);

export class RedisTransport implements IMessageTransport {
  readonly name = "redis";
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private options: RedisOptions;
  private handlers = new Map<string, ((data: any) => Promise<any> | void)[]>();

  private clientsPromise: Promise<{ pub: Redis; sub: Redis }> | null = null;

  constructor(
    options?: RedisOptions,
    private logger?: ILogger
  ) {
    this.options = options || { host: "localhost", port: 6379 };
    this.logger = logger || new InternalLogger();
  }

  setLogger(logger: ILogger): void {
    this.logger = logger;
  }

  async getClients(): Promise<{ pub: Redis; sub: Redis }> {
    if (this.pubClient && this.subClient) return { pub: this.pubClient, sub: this.subClient };
    if (this.clientsPromise) return this.clientsPromise;

    this.clientsPromise = (async () => {
      try {
        const IORedis = await import("ioredis");
        const RedisConstructor = IORedis.Redis || IORedis.default || IORedis;

        this.pubClient = new (RedisConstructor as any)(this.options) as Redis;
        this.subClient = new (RedisConstructor as any)(this.options) as Redis;

        this.logger?.info(`[RedisTransport] Connecting to Redis at ${this.options.host}:${this.options.port}`);

        this.subClient.on("message", async (channel: string, message: string) => {
          const listeners = this.handlers.get(channel);
          if (listeners) {
            try {
              const data = JSON.parse(message);
              await Promise.all(listeners.map(async (l) => {
                try {
                  const result = l(data);
                  if (result instanceof Promise) await result;
                } catch (err) {
                  this.logger?.error(`[RedisTransport] Error in handler for channel ${channel}:`, err);
                }
              }));
            } catch (err) {
              this.logger?.error(`[RedisTransport] Error parsing message on channel ${channel}:`, err);
            }
          }
        });

        this.subClient.on("error", (err: any) => this.logger?.error(`[RedisTransport] Sub Client Error:`, err));
        this.pubClient.on("error", (err: any) => this.logger?.error(`[RedisTransport] Pub Client Error:`, err));

        return { pub: this.pubClient, sub: this.subClient };
      } catch (error) {
        this.clientsPromise = null;
        this.logger?.error("[RedisTransport] Failed to initialize Redis clients", error);
        throw new Error("Redis dependency (ioredis) is missing.");
      }
    })();

    return this.clientsPromise;
  }

  async listen(
    topic: string,
    handler: (data: any) => Promise<any> | void,
    options?: RedisMessageOptions
  ): Promise<any> {
    const { sub } = await this.getClients();
    const redisOptions = options?.redis || options;

    if (redisOptions?.stream) {
      const group = redisOptions.stream.group || "hyper-decor-group";
      const consumer = redisOptions.stream.consumer || `consumer-${Math.random().toString(36).slice(2, 9)}`;

      // 1. Create group if not exists
      try {
        await sub.xgroup("CREATE", topic, group, "$", "MKSTREAM");
      } catch (e: any) {
        if (!e.message.includes("BUSYGROUP")) throw e;
      }

      // 2. Start consumer loop
      this.startStreamConsumer(topic, group, consumer, handler);
      return { topic, group, consumer };
    }

    // Default Pub/Sub
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, []);
      this.logger?.info(`[RedisTransport] Subscribing to topic: ${topic}`);
      await sub.subscribe(topic);
    }
    this.handlers.get(topic)?.push(handler);
  }

  private async startStreamConsumer(topic: string, group: string, consumer: string, handler: (data: any) => Promise<any> | void) {
    const { sub } = await this.getClients();
    while (this.subClient === sub) {
      try {
        // Read new messages
        const results = await (sub as any).xreadgroup("GROUP", group, consumer, "COUNT", 10, "BLOCK", 0, "STREAMS", topic, ">") as [string, [string, string[]][]][];
        if (!results) continue;

        for (const [stream, messages] of results) {
          for (const [id, fields] of messages) {
            try {
              // Redis Streams store fields in pairs [key, val, key, val...]
              // We assume 'data' field contains the JSON payload
              const dataStr = fields[1];
              const data = JSON.parse(dataStr);
              const result = handler(data);
              if (result instanceof Promise) await result;

              // Acknowledge
              await sub.xack(topic, group, id);
            } catch (err) {
              this.logger?.error(`[RedisTransport] Stream error on ${topic}:`, err);
            }
          }
        }
      } catch (err) {
        this.logger?.error(`[RedisTransport] Stream consumer loop error:`, err);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  async emit(topic: string, data: any, options?: IMessageEmitOptions & { useStream?: boolean, redis?: any }): Promise<void> {
    const { pub } = await this.getClients();
    const payload = JSON.stringify(data);

    const redisOptions = options?.redis || options;

    if (redisOptions?.useStream) {
      // Use XADD for Redis Streams
      await pub.xadd(topic, "*", "data", payload);
      return;
    }

    // Default Pub/Sub
    await pub.publish(topic, payload);
  }

  async isConnected(): Promise<boolean> {
    if (!this.pubClient || !this.subClient) return false;
    try {
      await this.pubClient.ping();
      await this.subClient.ping();
      return true;
    } catch (e) {
      return false;
    }
  }


  async close() {
    if (this.pubClient) await this.pubClient.quit();
    if (this.subClient) await this.subClient.quit();
    this.pubClient = null;
    this.subClient = null;
  }


  async onInit(): Promise<any> {
    await this.getClients();
  }
}
