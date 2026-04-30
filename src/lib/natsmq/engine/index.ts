import { connect, NatsConnection, JetStreamClient, JetStreamManager, StringCodec, JsMsg, JSONCodec, RetentionPolicy, Consumer, StorageType } from "nats";
import {
  NatsMQOptions,
  IConcurrencyStore,
  NatsMQMetrics,
  NatsSubscriptionMeta,
  NatsConcurrencyMeta,
  INatsProvider
} from "../types";
import { LocalConcurrencyStore } from "../store/local-store";
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

  public get metrics(): NatsMQMetrics | undefined {
    return this.options.metrics;
  }

  /**
   * Retrieves the current number of active concurrent handlers for a subject.
   */
  public async getActiveCount(subject?: string | INatsProvider<any>): Promise<number> {
    if (!subject) return this.store.getGlobalActiveCount();

    const pattern = typeof subject === "string"
      ? subject
      : subject.getNatsConfig().subject;

    return this.store.getActiveCount(pattern);
  }

  /**
   * Retrieves the global active count across all subjects.
   */
  public async getGlobalActiveCount(): Promise<number> {
    return this.store.getGlobalActiveCount();
  }

  /**
   * Gets a specific metric counter from the provider.
   */
  public async getCounter(type: 'received' | 'success' | 'error', subject?: string | INatsProvider<any>): Promise<number> {
    return this.options.metrics?.getCounter(type, subject) || 0;
  }

  /**
   * Gets the average latency for a subject or provider.
   */
  public async getAverageLatency(subject?: string | INatsProvider<any>): Promise<number> {
    return this.options.metrics?.getAverageLatency(subject || "") || 0;
  }

  /**
   * Retrieves the number of pending and unacknowledged messages for a specific contract.
   */
  public async getPendingCount(contract: INatsProvider<any>): Promise<{ pending: number, unacked: number }> {
    if (!this.jsm || !this.running) return { pending: 0, unacked: 0 };
    const config = contract.getNatsConfig();
    const stream = config.options.stream;
    if (!stream) return { pending: 0, unacked: 0 };
    const durableName = config.options.durable_name || stream;
    try {
      const info = await this.jsm.consumers.info(stream, durableName);
      return {
        pending: info.num_pending,
        unacked: info.num_ack_pending
      };
    } catch (err) {
      return { pending: 0, unacked: 0 };
    }
  }

  async start(): Promise<void> {
    if (this.running) return;
    try {
      if (this.store.onInit) await this.store.onInit();
      this.nc = await connect({ servers: this.options.servers });
      this.js = this.nc.jetstream();
      this.jsm = await this.nc.jetstreamManager();
      this.running = true;
      console.log(`[Engine] 🔌 Connected to NATS: ${this.options.servers}`);
    } catch (err) {
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

  /**
   * Deletes a stream from NATS. Useful for cleanup in tests.
   */
  async deleteStream(name: string): Promise<void> {
    if (!this.jsm) return;
    try {
      await this.jsm.streams.delete(name);
      console.log(`[Engine] 🗑️ Stream deleted: ${name}`);
    } catch (err) {
      // Ignore if not found
    }
  }

  async provisionStream(meta: NatsSubscriptionMeta): Promise<void> {
    if (!this.jsm) throw new Error("Engine not started");
    const streamName = meta.options.stream;
    if (!streamName) return;

    try {
      const info = await this.jsm.streams.info(streamName);
      const currentSubjects = info.config.subjects || [];

      const { updated, merged } = this.mergeSubjects(currentSubjects, meta.subject);

      if (updated) {
        await this.jsm.streams.update(streamName, {
          ...info.config,
          subjects: merged,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("stream not found")) {
        await this.jsm.streams.add({
          name: streamName,
          subjects: [meta.subject],
          retention: meta.options?.retention || RetentionPolicy.Limits,
          storage: meta.options?.storage || StorageType.File
        });
      } else {
        throw err;
      }
    }
  }

  private mergeSubjects(current: string[], newSubject: string): { updated: boolean; merged: string[] } {
    if (current.includes(newSubject)) return { updated: false, merged: current };

    const all = Array.from(new Set([...current, newSubject]));
    const filtered = all.filter(s => {
      return !all.some(other => {
        if (s === other) return false;
        if (other === ">") return true;
        if (other.endsWith(".>")) {
          const prefix = other.slice(0, -2);
          return s.startsWith(prefix);
        }
        return false;
      });
    });

    const isDifferent = filtered.length !== current.length || !filtered.every(s => current.includes(s));
    return { updated: isDifferent, merged: filtered };
  }

  async createPullConsumer(
    meta: NatsSubscriptionMeta,
    concurrencies: NatsConcurrencyMeta[],
    handler: (data: unknown, msg: JsMsg) => Promise<unknown>
  ): Promise<void> {
    if (!this.js || !this.running) throw new Error("Engine not started");
    const stream = meta.options.stream;
    if (!stream) throw new Error("Stream required for Pull Consumers");

    // Priority: Explicit durable_name > Stream name > Method name fallback
    const durableName = meta.options.durable_name || stream || `${meta.methodName}_consumer`;
    const { stream: _stream, max_messages: _maxMsgs, ...natsOptions } = meta.options;

    try {
      await this.jsm?.consumers.info(stream, durableName);
    } catch (err) {
      const { AckPolicy } = await import("nats");
      await this.jsm?.consumers.add(stream, {
        ...natsOptions,
        durable_name: durableName,
        ack_policy: natsOptions.ack_policy || AckPolicy.Explicit,
        max_deliver: natsOptions.max_deliver || 100
      });
    }

    const consumer = await this.js.consumers.get(stream, durableName);
    this.consumers.set(meta.subject, { consumer, meta });

    // Synchronization: Pull batch size and local inflight
    const maxAckPending = natsOptions.max_ack_pending || 1000;
    const pullBatch = meta.options.max_messages || Math.min(50, maxAckPending);

    const messages = await consumer.consume({
      max_messages: pullBatch,
    });

    // Tracking for local worker concurrency (inflight control)
    let localInflight = 0;
    // We allow local buffering up to the NATS server limit (max_ack_pending)
    const maxLocalInflight = maxAckPending;

    (async () => {
      for await (const msg of messages) {
        if (!this.running) {
          await msg.nak();
          break;
        }

        if (this.options.metrics) {
          this.options.metrics.recordMessageReceived(msg.subject);
        }

        const process = async () => {
          localInflight++;
          try {
            await this.processMessage(msg, meta, concurrencies, handler);
          } catch (err) {
            console.error(`[Engine] ❌ Critical processing error for ${msg.subject}:`, err);
          } finally {
            localInflight--;
          }
        };

        if (concurrencies.length > 0) {
          // In concurrency mode, we allow some local buffering but we don't block the pull loop 
          // too much unless we are really saturated. 
          // The actual waiting happens inside processMessage (acquire retry)
          while (localInflight >= maxLocalInflight) {
            await delay(100);
          }
          process();
        } else {
          process();
        }
      }
    })().catch(err => {
      if (this.running) console.error(`[Engine] ❌ Consumer error:`, err);
    });
  }

  private async processMessage(
    msg: JsMsg,
    meta: NatsSubscriptionMeta,
    concurrencies: NatsConcurrencyMeta[],
    handler: (data: unknown, msg: JsMsg) => Promise<unknown>
  ): Promise<boolean> {
    const routine = async () => {
      const start = Date.now();
      try {
        const decoded = this.jc.decode(msg.data);
        const parsed = meta.schema.parse(decoded);
        await handler(parsed, msg);
        await msg.ack();

        if (this.options.metrics) {
          const duration = Date.now() - start;
          await this.options.metrics.recordProcessingSuccess(msg.subject, duration);
        }
      } catch (err) {
        if (this.options.metrics) {
          await this.options.metrics.recordProcessingError(msg.subject, "handler_error");
        }
        throw err;
      }
    };

    if (concurrencies.length > 0) {
      let locks: ILock[] = [];
      let success = false;
      const startAcquire = Date.now();
      const maxAcquireTime = 60000; // 60s timeout for local retry

      // Retry loop for acquiring locks instead of immediate NAK
      while (!success && (Date.now() - startAcquire < maxAcquireTime)) {
        locks = [];
        let allLocked = true;

        try {
          for (const c of concurrencies) {
            const ttl = c.ttlMs || 60000;
            let lockKey = c.pattern;

            // Resolve dynamic lock keys (e.g. "jobs.:id" -> "jobs.123")
            if (lockKey.includes(':')) {
              const baseSubject = meta.originalSubject || meta.subject;
              const patternParts = baseSubject.split('.');
              const subjectParts = msg.subject.split('.');

              const parts = lockKey.split('.');
              for (let i = 0; i < parts.length; i++) {
                if (parts[i].startsWith(':')) {
                  // Find the index in the original subject that matches this param
                  const paramIndex = patternParts.findIndex(p => p === parts[i]);
                  if (paramIndex !== -1 && subjectParts[paramIndex]) {
                    lockKey = lockKey.replace(parts[i], subjectParts[paramIndex]);
                  }
                }
              }
            }

            const lock = await this.store.acquire([lockKey], ttl, { limit: c.limit });
            if (!lock) {
              allLocked = false;
              break;
            }
            locks.push(lock);
          }

          if (allLocked) {
            success = true;
          } else {
            // Release what we got and wait
            for (const l of locks) await this.store.release(l);
            await delay(Math.random() * 100 + 50); // Jittered wait
          }
        } catch (err) {
          for (const l of locks) await this.store.release(l);
          throw err;
        }
      }

      if (!success) {
        msg.nak();
        return false;
      }

      try {
        await routine();
      } finally {
        for (const l of locks) await this.store.release(l);
      }
      return true;
    }

    try {
      await routine();
      return true;
    } catch (err) {
      console.error(`[Engine] ❌ Error in handler for ${msg.subject}:`, err);
      msg.nak();
      return false;
    }
  }

  async publish<T>(subjectOrContract: string | INatsProvider<T>, schemaOrData: z.ZodType<T> | T, maybeData?: T): Promise<void> {
    if (!this.js || !this.running) throw new Error("Engine not started");

    let subject: string;
    let schema: z.ZodType<T>;
    let data: T;

    if (typeof subjectOrContract === "string") {
      subject = subjectOrContract;
      schema = schemaOrData as z.ZodType<T>;
      data = maybeData as T;
    } else {
      const config = subjectOrContract.getNatsConfig();
      subject = config.subject;
      schema = config.schema;
      data = schemaOrData as T;
    }

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
