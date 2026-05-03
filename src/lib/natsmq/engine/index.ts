import { connect, NatsConnection, JetStreamClient, JetStreamManager, StringCodec, JsMsg, JSONCodec, RetentionPolicy, Consumer, StorageType, PublishOptions, PubAck, AckPolicy } from "nats";
import {
  NatsMQOptions,
  IConcurrencyStore,
  NatsMQMetrics,
  NatsSubscriptionMeta,
  NatsConcurrencyMeta,
  INatsProvider,
  SubscriptionTask,
  NatsSubscriptionOptions
} from "../types";
import { LocalConcurrencyStore } from "../store/local-store";
import { z } from "zod";
import { ILock } from "../../lock/lock";
import type { ConsumerConfig } from "nats";

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
  public async getActiveCount(subject?: string | INatsProvider<unknown>): Promise<number> {
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
  public async getCounter(type: 'received' | 'success' | 'error', subject?: string | INatsProvider<unknown>): Promise<number> {
    return this.options.metrics?.getCounter(type, subject) || 0;
  }

  /**
   * Gets the average latency for a subject or provider.
   */
  public async getAverageLatency(subject?: string | INatsProvider<unknown>): Promise<number> {
    return this.options.metrics?.getAverageLatency(subject || "") || 0;
  }

  /**
   * Retrieves the number of pending and unacknowledged messages for a specific contract.
   */
  public async getPendingCount(contract: INatsProvider<unknown>): Promise<{ pending: number, unacked: number }> {
    if (!this.jsm || !this.running) return { pending: 0, unacked: 0 };
    const config = contract.getNatsConfig();
    const stream = config.options.stream;
    if (!stream) return { pending: 0, unacked: 0 };

    const durableName = this.getEffectiveDurableName(config.subject, config.options);

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
    await this.provisionStreamInternal(meta.options.stream!, [meta.subject], meta.options);
  }

  /**
   * Provisions all necessary infrastructure (streams and durable consumers) for a list of tasks.
   * This is optimized to batch subjects by stream to avoid NATS collision errors.
   */
  async provisionInfrastructure(tasks: SubscriptionTask[]): Promise<void> {
    const streams = new Map<string, { subjects: Set<string>, options: NatsSubscriptionOptions }>();

    for (const task of tasks) {
      const streamName = task.meta.options.stream || "DEFAULT_STREAM";
      if (!streams.has(streamName)) {
        streams.set(streamName, { subjects: new Set(), options: task.meta.options });
      }
      streams.get(streamName)!.subjects.add(task.meta.subject);
    }

    // 1. Provision Streams (one update/add per stream)
    for (const [streamName, data] of streams.entries()) {
      await this.provisionStreamInternal(streamName, Array.from(data.subjects), data.options);
    }

    // 2. Pre-provision durable consumers (Standby mode)
    for (const task of tasks) {
      if (task.meta.options.durable_name) {
        await this.provisionConsumer(task.meta);
      }
    }
  }

  /**
   * Activates the pull consumers for the given tasks.
   */
  async activateConsumers(tasks: SubscriptionTask[]): Promise<void> {
    for (const task of tasks) {
      if (task.handler) {
        await this.createPullConsumer(task.meta, task.meta.concurrencies, task.handler);
      }
    }
  }

  private async provisionStreamInternal(stream: string, subjects: string[], options: NatsSubscriptionOptions): Promise<void> {
    if (!this.jsm) throw new Error("Engine not started");

    try {
      const info = await this.jsm.streams.info(stream);
      const currentSubjects = info.config.subjects || [];

      let mergedSubjects = [...currentSubjects];
      let updated = false;
      for (const s of subjects) {
        const result = this.mergeSubjects(mergedSubjects, s);
        if (result.updated) {
          mergedSubjects = result.merged;
          updated = true;
        }
      }

      if (updated) {
        await this.jsm.streams.update(stream, {
          ...info.config,
          subjects: mergedSubjects,
          duplicate_window: options.duplicate_window_ns || this.sec_to_ns(3600)
        });
      }
    } catch (err: any) {
      if (err.message?.includes("stream not found")) {
        await this.jsm.streams.add({
          name: stream,
          subjects: subjects,
          retention: options.retention || RetentionPolicy.Limits,
          storage: options.storage || StorageType.Memory,
          duplicate_window: options.duplicate_window_ns || this.sec_to_ns(3600)
        });
      } else {
        throw err;
      }
    }
  }

  /**
   * Internal helper to provision a durable consumer without starting consumption.
   */
  private async provisionConsumer(meta: NatsSubscriptionMeta): Promise<void> {
    if (!this.jsm) throw new Error("Engine not started");
    const stream = meta.options.stream;
    if (!stream) return;

    const durableName = this.getEffectiveDurableName(meta.subject, meta.options);

    try {
      await this.jsm.consumers.info(stream, durableName);
    } catch (err) {
      const config = this.sanitizeConsumerConfig(meta.options);
      await this.jsm.consumers.add(stream, {
        ...config,
        filter_subject: meta.subject,
        durable_name: durableName,
        ack_policy: config.ack_policy || AckPolicy.Explicit,
        max_deliver: config.max_deliver || 100
      });
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

    const durableName = this.getEffectiveDurableName(meta.subject, meta.options);

    try {
      await this.jsm?.consumers.info(stream, durableName);
    } catch (err) {
      const config = this.sanitizeConsumerConfig(meta.options);
      await this.jsm?.consumers.add(stream, {
        ...config,
        durable_name: durableName,
        ack_policy: config.ack_policy || AckPolicy.Explicit,
        max_deliver: config.max_deliver || 100
      });
    }

    const consumer = await this.js.consumers.get(stream, durableName);
    this.consumers.set(meta.subject, { consumer, meta });

    // Synchronization: Pull batch size and local inflight
    const maxAckPending = meta.options.max_ack_pending || 1000;
    const pullBatch = meta.options.max_messages || Math.min(50, maxAckPending);

    const messages = await consumer.consume({
      max_messages: pullBatch,
    });

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
          try {
            await this.processMessage(msg, meta, concurrencies, handler);
          } catch (err) {
            console.error(`[Engine] ❌ Critical processing error for ${msg.subject}:`, err);
          }
        };

        process();
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
    const start = Date.now();

    const handleFailure = async (err: any) => {
      const redeliveries = msg.info.redeliveryCount;
      const maxDeliver = meta.options.max_deliver || 100;

      if (this.options.metrics) {
        await this.options.metrics.recordProcessingError(msg.subject, "handler_error");
      }

      // 🛡️ DLS Implementation: If we reached max_deliver, move to DLS and TERMINATE
      if (redeliveries >= maxDeliver) {
        console.error(`[Engine] 💀 Message exceeded max_deliver (${maxDeliver}). terminating.`);
        
        if (this.dlsSubject) {
          try {
            const payload = {
              subject: msg.subject,
              data: this.jc.decode(msg.data),
              error: err instanceof Error ? err.message : String(err),
              attempts: redeliveries,
              timestamp: new Date().toISOString()
            };
            // Use a short timeout for DLS publish to avoid hanging
            await this.js!.publish(this.dlsSubject, this.jc.encode(payload), { timeout: 2000 });
          } catch (dlsErr) {
            console.error(`[Engine] ❌ Failed to publish to DLS:`, dlsErr);
          }
        }
        
        await msg.term(); // Always terminate if we reached the limit
        return;
      }

      // Normal NAK with exponential backoff or default delay
      const backoffIndex = Math.min(redeliveries - 1, this.retryBackoff.length - 1);
      const nakDelay = this.retryBackoff[backoffIndex] || 1000;
      
      console.warn(`[Engine] ⚠️ Processing failed for ${msg.subject}. NAKing with ${nakDelay}ms delay. (Attempt ${redeliveries})`);
      msg.nak(nakDelay);
    };

    const routine = async () => {
      // 💓 Start a background heartbeat to keep the message alive during long processing
      const heartbeat = setInterval(() => {
        try { msg.working(); } catch (e) {}
      }, 1000); // Every 1s to be safer than most ack_waits

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
        await handleFailure(err);
        throw err;
      } finally {
        clearInterval(heartbeat);
      }
    };

    if (concurrencies.length > 0) {
      let locks: ILock[] = [];
      let success = false;
      const startAcquire = Date.now();
      const maxAcquireTime = 30000; // 30s max wait before NAKing to another node
      let lastHeartbeat = Date.now();
      while (!success && (Date.now() - startAcquire < maxAcquireTime)) {
        locks = [];
        let allLocked = true;

        try {
          // Tell NATS we are still working periodically (every 1s)
          // This must be shorter than the consumer's ack_wait
          if (Date.now() - lastHeartbeat > 1000) {
            msg.working();
            lastHeartbeat = Date.now();
          }

          for (const c of concurrencies) {
            const ttl = c.ttlMs || 60000;
            let lockKey = c.pattern;

            if (lockKey.includes(':')) {
              const baseSubject = meta.originalSubject || meta.subject;
              const patternParts = baseSubject.split('.');
              const subjectParts = msg.subject.split('.');
              const parts = lockKey.split('.');
              for (let i = 0; i < parts.length; i++) {
                if (parts[i].startsWith(':')) {
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
            // Release what we got and wait a bit with jitter
            for (const l of locks) await this.store.release(l);
            await delay(Math.random() * 200 + 100); 
          }
        } catch (err) {
          for (const l of locks) await this.store.release(l);
          await handleFailure(err);
          return false;
        }
      }

      if (!success) {
        // We couldn't get the lock in 30s. NAK with delay so NATS can try elsewhere or later.
        console.warn(`[Engine] 🔒 Could not acquire locks for ${msg.subject} in ${maxAcquireTime}ms. NAKing.`);
        msg.nak(2000); 
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
      // Failure already handled in routine() catch block
      return false;
    }
  }

  /**
   * Publishes a message to NATS JetStream.
   * Supports both contracts and raw subjects, with optional NATS publish options (like msgId for idempotency).
   */
  async publish<T>(
    target: string | INatsProvider<T>,
    data: T,
    options: PublishOptions & { subject?: string, idempotencyKey?: string } = {}
  ): Promise<void> {
    if (!this.js || !this.running) throw new Error("Engine not started");

    let subject: string;
    let schema: z.ZodType<T>;

    if (typeof target === "string") {
      subject = options.subject || target;
      schema = (z.any() as any);
    } else {
      const config = target.getNatsConfig();
      subject = options.subject || config.subject;
      schema = config.schema;
    }

    const payload = this.jc.encode(schema.parse(data));
    await this.js.publish(subject, payload, {
      msgID: options?.idempotencyKey,
    });
  }

  /**
   * Publishes a batch of messages to NATS JetStream.
   */
  async publishBatch<T>(
    target: string | INatsProvider<T>,
    items: Array<{ data: T; options?: PublishOptions & { subject?: string, idempotencyKey?: string } }>
  ): Promise<void> {
    if (!this.js || !this.running) throw new Error("Engine not started");

    const promises = items.map((item) => this.publish(target, item.data, item.options));
    await Promise.all(promises);
  }


  async request<TReq, TRes>(subject: string, reqSchema: z.ZodType<TReq>, resSchema: z.ZodType<TRes>, data: TReq): Promise<TRes> {
    if (!this.nc || !this.running) throw new Error("Engine not started");
    const payload = this.jc.encode(reqSchema.parse(data));
    const msg = await this.nc.request(subject, payload);
    return resSchema.parse(this.jc.decode(msg.data));
  }



  private sec_to_ns(sec: number): number {
    return Math.round(sec * 1_000_000_000);
  }

  /**
   * Internal helper to resolve the durable name for a consumer.
   */
  public getEffectiveDurableName(subject: string, options: NatsSubscriptionOptions): string {
    if (options.durable_name) return options.durable_name;
    // Default convention: cons_ + subject (sanitized)
    return `cons_${subject.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  /**
   * Filters NatsSubscriptionOptions to return only valid ConsumerConfig fields.
   */
  private sanitizeConsumerConfig(options: NatsSubscriptionOptions): Partial<ConsumerConfig> {
    const validKeys: (keyof ConsumerConfig)[] = [
      "ack_policy",
      "deliver_policy",
      "deliver_group",
      "durable_name",
      "name",
      "flow_control",
      "idle_heartbeat",
      "opt_start_seq",
      "opt_start_time",
      "rate_limit_bps",
      "replay_policy",
      "pause_until",
      "description",
      "ack_wait",
      "max_deliver",
      "sample_freq",
      "max_ack_pending",
      "max_waiting",
      "headers_only",
      "deliver_subject",
      "max_batch",
      "max_expires",
      "inactive_threshold",
      "backoff",
      "max_bytes",
      "num_replicas",
      "mem_storage",
      "filter_subject",
      "filter_subjects",
      "metadata"
    ];

    const config: Partial<ConsumerConfig> = {};
    for (const key of validKeys) {
      if (options[key as keyof NatsSubscriptionOptions] !== undefined) {
        (config as any)[key] = options[key as keyof NatsSubscriptionOptions];
      }
    }
    return config;
  }
}
