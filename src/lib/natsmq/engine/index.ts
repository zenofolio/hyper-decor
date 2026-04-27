import { connect, NatsConnection, JetStreamClient, JetStreamManager, StringCodec, ConsumerOptsBuilder, consumerOpts, JsMsg, JSONCodec } from "nats";
import { NatsMQOptions, IConcurrencyStore } from "../types";
import { LocalConcurrencyStore } from "../store/local-store";
import { NatsSubscriptionMeta, NatsConcurrencyMeta } from "../decorators";
import { z } from "zod";

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

  constructor(private options: NatsMQOptions) {
    this.store = options.concurrencyStore || new LocalConcurrencyStore();
    this.dlsSubject = options.dlsSubject || null;
    this.retryBackoff = options.retryBackoffMs || [1000, 2000, 5000];
  }

  /**
   * Initializes the NATS connection, JetStream context, and the Concurrency Store.
   */
  async start(): Promise<void> {
    if (this.running) return;

    if (this.store.onInit) {
      await this.store.onInit();
    }

    this.nc = await connect({ servers: this.options.servers });
    this.js = this.nc.jetstream();
    this.jsm = await this.nc.jetstreamManager();
    this.running = true;
  }

  /**
   * Gracefully shuts down the engine, waiting for active handlers to complete.
   */
  async close(): Promise<void> {
    this.running = false; // Stops all pull loops from requesting new messages
    
    // Wait for in-flight tasks to clear or timeout
    let waitCycles = 0;
    while (waitCycles < 50) { // Max 5 seconds waiting for drain
      const active = await this.store.getGlobalActiveCount();
      if (active === 0) break;
      await delay(100);
      waitCycles++;
    }

    if (this.store.close) {
      await this.store.close();
    }

    if (this.nc) {
      await this.nc.drain();
      await this.nc.close();
      this.nc = null;
    }
  }

  /**
   * Auto-provisions a stream based on the provided metadata.
   */
  async provisionStream(meta: NatsSubscriptionMeta): Promise<void> {
    if (!this.jsm) throw new Error("Engine not started");
    const streamName = meta.options.stream;
    if (!streamName) return; // Core NATS pub/sub, not JetStream

    try {
      await this.jsm.streams.info(streamName);
      // If it exists, we could check/update subjects, but for safety we leave it.
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "stream not found") {
        await this.jsm.streams.add({
          name: streamName,
          subjects: [meta.subject],
          retention: "limits",
        });
      } else {
        throw err;
      }
    }
  }

  /**
   * The core pull loop. Manages Zod validation, the Semaphore, and JetStream ACKs.
   */
  async createPullConsumer(
    meta: NatsSubscriptionMeta,
    concurrencyMeta: NatsConcurrencyMeta | undefined,
    handler: (data: unknown, msg: JsMsg) => Promise<unknown>
  ): Promise<void> {
    if (!this.js || !this.running) throw new Error("Engine not started");

    const stream = meta.options.stream;
    if (!stream) {
      throw new Error(`@OnNatsMessage requires a stream option to use Pull Consumers (method: ${meta.methodName})`);
    }

    const durableName = meta.options.durable_name || `${meta.methodName}_consumer`;
    
    // Ensure consumer exists
    try {
      await this.jsm?.consumers.info(stream, durableName);
    } catch {
      await this.jsm?.consumers.add(stream, {
        ...meta.options,
        durable_name: durableName,
        filter_subject: meta.subject
      });
    }

    const consumer = await this.js.consumers.get(stream, durableName);

    // Start background loop
    this.runPullLoop(consumer, meta, concurrencyMeta, handler);
  }

  private async runPullLoop(
    consumer: unknown, 
    meta: NatsSubscriptionMeta, 
    concurrencyMeta: NatsConcurrencyMeta | undefined,
    handler: (data: unknown, msg: JsMsg) => Promise<unknown>
  ) {
    while (this.running) {
      try {
        const messages = await (consumer as any).fetch({ max_messages: 10, expires: 2000 });
        for await (const msg of messages as Iterable<JsMsg>) {
          if (!this.running) {
            msg.nak();
            continue;
          }
          // Process in background, don't await here to allow concurrent handling of the batch
          this.processMessage(msg, meta, concurrencyMeta, handler).catch(console.error);
        }
      } catch (err: unknown) {
        // NATS fetch timeout throws if no messages are available, just ignore and retry
        const natsErr = err as { code?: string; message?: string };
        if (natsErr.code !== '404' && natsErr.message !== 'timeout') {
          console.error(`[NatsMQ] Pull loop error for ${meta.subject}:`, err);
          await delay(2000); // Backoff on actual connection errors
        }
      }
    }
  }

  private async processMessage(
    msg: JsMsg,
    meta: NatsSubscriptionMeta,
    concurrencyMeta: NatsConcurrencyMeta | undefined,
    handler: (data: unknown, msg: JsMsg) => Promise<unknown>
  ) {
    // 1. Zod Validation (Pre-execution)
    let payload: unknown;
    try {
      const raw = this.jc.decode(msg.data);
      const parsed = meta.schema.safeParse(raw);
      if (!parsed.success) {
        console.error(`[NatsMQ] Validation failed for ${msg.subject}:`, parsed.error.issues);
        if (this.dlsSubject && this.nc) {
          this.nc.publish(this.dlsSubject, this.jc.encode({
            subject: msg.subject,
            error: parsed.error.issues,
            payload: raw
          }));
        }
        await msg.term(); // Terminal state: Never redeliver
        return;
      }
      payload = parsed.data;
    } catch (e) {
      console.error(`[NatsMQ] JSON parse failed for ${msg.subject}`, e);
      await msg.term(); // Terminal state
      return;
    }

    // 2. Concurrency Semaphore (Subject-based)
    if (concurrencyMeta) {
      const acquired = await this.store.acquire(
        msg.subject, // Exact subject 
        concurrencyMeta.limit, 
        this.options.defaultTtlMs || 30000
      );

      if (!acquired) {
        // Calculate backoff
        const deliveryCount = msg.info.redeliveryCount;
        const delayMs = this.retryBackoff[Math.min(deliveryCount - 1, this.retryBackoff.length - 1)] || 2000;
        await msg.nak(delayMs);
        return;
      }
    }

    // 3. Execution (Protected)
    try {
      const response = await handler(payload, msg);
      
      // Request-Reply handling
      if (meta.isRequest && msg.reply) {
        let resPayload = response;
        if (meta.responseSchema) {
          resPayload = meta.responseSchema.parse(response);
        }
        msg.respond(this.jc.encode(resPayload));
      }
      
      await msg.ack(); // Success
    } catch (err) {
      console.error(`[NatsMQ] Handler error for ${msg.subject}:`, err);
      await msg.nak(); // Standard retryable error
    } finally {
      if (concurrencyMeta) {
        await this.store.release(msg.subject); // Invariant: Must release lock
      }
    }
  }

  // --- Public APIs for publishing and advanced operations ---
  
  async publish<T extends z.ZodTypeAny>(subject: string, schema: T, data: z.infer<T>): Promise<void> {
    if (!this.js) throw new Error("Engine not started");
    const parsed = schema.parse(data);
    await this.js.publish(subject, this.jc.encode(parsed));
  }

  async request<TReq extends z.ZodTypeAny, TRes extends z.ZodTypeAny>(
    subject: string, reqSchema: TReq, resSchema: TRes, data: z.infer<TReq>
  ): Promise<z.infer<TRes>> {
    if (!this.nc) throw new Error("Engine not started");
    const parsed = reqSchema.parse(data);
    const res = await this.nc.request(subject, this.jc.encode(parsed), { timeout: 10000 });
    const rawRes = this.jc.decode(res.data);
    return resSchema.parse(rawRes);
  }
}
