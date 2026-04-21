import { singleton } from "tsyringe";
import { IMessageTransport, IMessageOptions, IMessageEmitOptions } from "../transport";
import type { Redis, RedisOptions } from "ioredis";
import { ILogger, InternalLogger } from "../logger";

@singleton()
export class RedisTransport implements IMessageTransport {
  readonly name = "redis";
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private options: RedisOptions;
  private handlers = new Map<string, ((data: any) => Promise<void> | void)[]>();
  private logger: ILogger;

  private clientsPromise: Promise<{ pub: Redis; sub: Redis }> | null = null;

  constructor(options?: RedisOptions, logger?: ILogger) {
    this.options = options || { host: "localhost", port: 6379 };
    this.logger = logger || new InternalLogger();
  }

  private async getClients(): Promise<{ pub: Redis; sub: Redis }> {
    if (this.pubClient && this.subClient) return { pub: this.pubClient, sub: this.subClient };
    if (this.clientsPromise) return this.clientsPromise;

    this.clientsPromise = (async () => {
      try {
        const IORedis = await import("ioredis");
        const RedisConstructor = IORedis.Redis || IORedis.default || IORedis;

        this.pubClient = new (RedisConstructor as any)(this.options) as Redis;
        this.subClient = new (RedisConstructor as any)(this.options) as Redis;

        this.logger.info(`[RedisTransport] Connecting to Redis at ${this.options.host}:${this.options.port}`);

        this.subClient.on("message", async (channel: string, message: string) => {
          const listeners = this.handlers.get(channel);
          if (listeners) {
            try {
              const data = JSON.parse(message);
              this.logger.debug(`[RedisTransport] Received message on channel ${channel}`);
              await Promise.all(listeners.map(async (l) => {
                try {
                  const result = l(data);
                  if (result instanceof Promise) await result;
                } catch (err) {
                  this.logger.error(`[RedisTransport] Error in handler for channel ${channel}:`, err);
                }
              }));
            } catch (err) {
              this.logger.error(`[RedisTransport] Error parsing message on channel ${channel}:`, err);
            }
          }
        });

        this.subClient.on("error", (err: any) => this.logger.error(`[RedisTransport] Sub Client Error:`, err));
        this.pubClient.on("error", (err: any) => this.logger.error(`[RedisTransport] Pub Client Error:`, err));
        this.subClient.on("connect", () => this.logger.info(`[RedisTransport] Sub Client Connected`));
        this.pubClient.on("connect", () => this.logger.info(`[RedisTransport] Pub Client Connected`));

        return { pub: this.pubClient, sub: this.subClient };
      } catch (error) {
        this.clientsPromise = null;
        this.logger.error("[RedisTransport] Failed to initialize Redis clients", error);
        throw new Error(
          "Redis dependency (ioredis) is missing or connection failed. Please install 'ioredis' and check your config."
        );
      }
    })();

    return this.clientsPromise;
  }

  async listen(
    topic: string,
    handler: (data: any) => Promise<void> | void,
    options?: IMessageOptions
  ): Promise<void> {
    const { sub } = await this.getClients();

    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, []);
      this.logger.info(`[RedisTransport] Subscribing to topic: ${topic}`);
      await sub.subscribe(topic);
    }

    this.handlers.get(topic)?.push(handler);
  }

  async emit(topic: string, data: any, options?: IMessageEmitOptions): Promise<void> {
    const { pub } = await this.getClients();
    this.logger.debug(`[RedisTransport] Publishing message to topic: ${topic}`);
    await pub.publish(topic, JSON.stringify(data));
  }

  async close() {
    if (this.pubClient) await this.pubClient.quit();
    if (this.subClient) await this.subClient.quit();
    this.pubClient = null;
    this.subClient = null;
  }
}
