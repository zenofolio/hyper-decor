import { connect, NatsConnection, JetStreamClient, JetStreamManager, StringCodec, JsMsg, JSONCodec, RetentionPolicy, Consumer } from "nats";
import { NatsMQOptions, IConcurrencyStore } from "../types";
import { LocalConcurrencyStore } from "../store/local-store";
import { NatsSubscriptionMeta, NatsConcurrencyMeta } from "../decorators";
import { z } from "zod";
import { ILock } from "../../lock/lock";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


export class NatsMQEngine {
  private nc: NatsConnection | null = null;
  private jsm: JetStreamManager | null = null;
  private js: JetStreamClient | null = null;
  private store: IConcurrencyStore;
  private running = false;
  private sc = StringCodec();
  private jc = JSONCodec();
  private dlsSubject: string | null;
  private retryBackoff: number[];
  private consumers = new Map<string, { consumer: Consumer; meta: NatsSubscriptionMeta }>();

  constructor(private options: NatsMQOptions) {
    this.store = options.concurrencyStore || new LocalConcurrencyStore();
    this.dlsSubject = options.dlsSubject || null;
    this.retryBackoff = options.retryBackoffMs || [1000, 2000, 5000];
    console.log(`[Engine] 🚀 Initialized with Store: ${this.store.constructor.name}`);
  }

  async start(): Promise<void> {
    console.log(`[Engine] 🔌 Starting connection to ${this.options.servers}...`);
    if (this.running) return;
    try {
      if (this.store.onInit) await this.store.onInit();
      this.nc = await connect({ servers: this.options.servers });
      this.js = this.nc.jetstream();
      this.jsm = await this.nc.jetstreamManager();
      this.running = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }

  async close(): Promise<void> {
    this.running = false;
    let waitCycles = 0;
    while (waitCycles < 50) {
      const active = await this.store.getGlobalActiveCount();
      if (active === 0) break;
      await delay(100);
      waitCycles++;
    }
    if (this.store.close) await this.store.close();
    if (this.nc) {
      await this.nc.drain();
      await this.nc.close();
      this.nc = null;
    }
  }

  async provisionStream(meta: NatsSubscriptionMeta): Promise<void> {
    if (!this.jsm) throw new Error("Engine not started");
    const streamName = meta.options.stream;
    if (!streamName) return;
    try {
      await this.jsm.streams.info(streamName);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("stream not found")) {
        await this.jsm.streams.add({
          name: streamName,
          subjects: [meta.subject],
          retention: RetentionPolicy.Limits,
        });
      } else {
        throw err;
      }
    }
  }

  async createPullConsumer(
    meta: NatsSubscriptionMeta,
    concurrencyMeta: NatsConcurrencyMeta | undefined,
    handler: (data: unknown, msg: JsMsg) => Promise<unknown>
  ): Promise<void> {
    console.log(`[Engine] 📦 createPullConsumer for ${meta.subject} | Meta: ${!!concurrencyMeta}`);
    if (!this.js || !this.running) throw new Error("Engine not started");
    const stream = meta.options.stream;
    if (!stream) throw new Error("Stream required for Pull Consumers");
    const durableName = meta.options.durable_name || `${meta.methodName}_consumer`;
    try {
      await this.jsm?.consumers.info(stream, durableName);
    } catch {
      await this.jsm?.consumers.add(stream, {
        ...meta.options,
        durable_name: durableName,
        max_deliver: 100
      });
    }
    const consumer = await this.js.consumers.get(stream, durableName);
    this.consumers.set(meta.subject, { consumer, meta });

    const messages = await consumer.consume({
      max_messages: 100, // Pull everything available to handle it quickly
    });

    (async () => {
      for await (const msg of messages) {
        if (!this.running) {
          await msg.nak();
          break;
        }
        // Don't await processMessage here so we don't block the delivery of other messages
        this.processMessage(msg, meta, concurrencyMeta, handler).catch(err => {
          console.error(`[Engine] ❌ Critical processing error for ${msg.subject}:`, err);
        });
      }
    })().catch(err => {
      if (this.running) console.error(`[Engine] ❌ Consumer error:`, err);
    });
  }

  private async processMessage(
    msg: JsMsg,
    meta: NatsSubscriptionMeta,
    concurrencyMeta: NatsConcurrencyMeta | undefined,
    handler: (data: unknown, msg: JsMsg) => Promise<unknown>
  ): Promise<boolean> {
    const lockKey = concurrencyMeta ? (concurrencyMeta.pattern.includes("*") ? msg.subject : concurrencyMeta.pattern) : "";
    const ttl = concurrencyMeta?.ttlMs || 60000;

    const routine = async () => {
      const decoded = this.jc.decode(msg.data);
      const parsed = meta.schema.parse(decoded);
      await handler(parsed, msg);
      await msg.ack();
    };

    if (concurrencyMeta) {
      let lock: ILock | null = null;
      let attempts = 0;
      const maxAttempts = 50; // Wait up to 10s locally

      while (attempts < maxAttempts) {
        lock = await this.store.acquire([lockKey], ttl, { limit: concurrencyMeta.limit });
        if (lock) break;

        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 200)); // Wait and retry locally
        }
      }

      if (!lock) {
        msg.nak(100); // Finally give up and NAK
        return false;
      }

      // Process in background once lock is acquired
      (async () => {
        try {
          await routine();
        } finally {
          await this.store.release(lock);
        }
      })().catch(err => {
        console.error(`[Engine] ❌ Error in handler for ${msg.subject}:`, err);
        msg.nak();
      });
      return true;
    }

    routine().catch(err => {
      console.error(`[Engine] ❌ Error in handler for ${msg.subject}:`, err);
      msg.nak();
    });
    return true;
  }

  async publish<T>(subject: string, schema: z.ZodType<T>, data: T): Promise<void> {
    if (!this.js || !this.running) throw new Error("Engine not started");
    const payload = this.jc.encode(schema.parse(data));
    await this.js.publish(subject, payload);
  }

  async request<TReq, TRes>(subject: string, reqSchema: z.ZodType<TReq>, resSchema: z.ZodType<TRes>, data: TReq): Promise<TRes> {
    if (!this.nc || !this.running) throw new Error("Engine not started");
    const payload = this.jc.encode(reqSchema.parse(data));
    const msg = await this.nc.request(subject, payload);
    return resSchema.parse(this.jc.decode(msg.data));
  }
}
