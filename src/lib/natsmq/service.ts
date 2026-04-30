import { container } from "tsyringe";
import { NatsMQ } from "./index";
import { NatsMQOptions, NatsSubscriptionMeta, NatsMQMetadata, NatsMQMetrics, INatsProvider } from "./types";
import { getNatsMQMeta } from "./meta";
import { NatsMQWorkerOptions } from "./types";

export class NatsMQService {
  private static instance: NatsMQService;
  public mq?: NatsMQ;
  private options?: NatsMQOptions;

  private constructor() { }

  public static getInstance(): NatsMQService {
    if (!NatsMQService.instance) {
      NatsMQService.instance = new NatsMQService();
    }
    return NatsMQService.instance;
  }

  public configure(options: NatsMQOptions) {
    this.options = options;
    this.mq = new NatsMQ(options);
  }

  public async onInit() {
    if (this.mq) {
      await this.mq.start();
    }
  }

  /**
   * Registers one or more workers (classes or instances).
   * Returns an array of the registered instances.
   */
  public async register(...targets: any[]): Promise<any[]> {
    const instances = [];
    for (const target of targets) {
      if (typeof target === "function") {
        instances.push(await this.registerClass(target));
      } else {
        await this.registerInstance(target);
        instances.push(target);
      }
    }
    return instances;
  }

  private async registerClass(target: new (...args: any[]) => any) {
    const instance = container.resolve(target as new (...args: any[]) => any) as object;
    await this.registerInstance(instance);
    return instance;
  }

  public async registerInstance(target: any) {
    if (!this.mq) {
      throw new Error("NatsMQ not configured. Call configure() first.");
    }

    // 1. Get class-level metadata
    const classMeta = getNatsMQMeta(target);
    const combinedMeta: NatsMQMetadata = {
      subscriptions: new Map(classMeta.subscriptions),
      crons: new Map(classMeta.crons),
      workerOptions: classMeta.workerOptions,
      appConfig: classMeta.appConfig
    };

    // 2. Discover method-level metadata (for Stage 3 decorators)
    const prototype = Object.getPrototypeOf(target);
    if (prototype) {
      const methods = Object.getOwnPropertyNames(prototype);
      for (const methodName of methods) {
        if (methodName === "constructor") continue;
        const method = target[methodName];
        if (typeof method === "function") {
          const methodMeta = getNatsMQMeta(method);
          // Merge subscriptions
          if (methodMeta.subscriptions.size > 0) {
            for (const [key, sub] of Array.from(methodMeta.subscriptions.entries())) {
              combinedMeta.subscriptions.set(key, sub);
            }
          }
          // Merge crons
          if (methodMeta.crons.size > 0) {
            for (const [key, cron] of Array.from(methodMeta.crons.entries())) {
              combinedMeta.crons.set(key, cron);
            }
          }
        }
      }
    }

    if (combinedMeta.subscriptions.size === 0 && combinedMeta.crons.size === 0) {
      const constructor = typeof target === "function" ? target : target.constructor;
      console.warn(`[Service] ⚠️ No NatsMQ decorators found on ${constructor.name}`);
      return;
    }

    const classConfig: NatsMQWorkerOptions = combinedMeta.workerOptions || {};

    // 1. Auto-provision the primary queue/stream
    if (classConfig.queue) {
      const config = classConfig.queue.getNatsConfig();
      await this.mq.engine.provisionStream({
        subject: config.subject,
        options: config.options,
        key: `app:${config.subject}`,
        methodName: "factory",
        className: target.constructor.name,
        schema: config.schema,
        isRequest: false,
        concurrencies: []
      });
    }

    // 2. Setup NATS Consumers
    const subsList = Array.from(combinedMeta.subscriptions.values());
    for (const sub of subsList) {
      let resolvedSub: NatsSubscriptionMeta = sub;

      if (classConfig.queue && (classConfig.queue as any).define) {
        const factory = classConfig.queue as any;
        const prefix = factory.prefix || "";

        if (!sub.subject.includes('.') || !sub.subject.startsWith(prefix)) {
          const contract = factory.define(sub.subject, sub.schema, undefined, sub.options);
          const config = contract.getNatsConfig();
          resolvedSub = {
            ...sub,
            subject: config.subject,
            options: { ...config.options, filter_subject: config.subject }
          };
        }
      }

      await this.mq.engine.provisionStream(resolvedSub);
      const handler = (target as any)[sub.methodName];
      await this.mq.engine.createPullConsumer(resolvedSub, resolvedSub.concurrencies, handler.bind(target));
    }

    // 3. Setup Cron Jobs
    const cronsList = Array.from(combinedMeta.crons.values());
    for (const cron of cronsList) {
      const handler = (target as any)[cron.methodName];
      this.mq.cron.schedule(cron, handler.bind(target));
    }
  }

  public async close() {
    if (this.mq) {
      await this.mq.close();
    }
  }

  get metrics(): NatsMQMetrics | undefined {
    return this.mq?.engine.metrics;
  }

  /**
   * Gets a specific counter metric for a subject, contract or queue.
   */
  async getCounter(type: 'received' | 'success' | 'error', target?: string | INatsProvider<any>): Promise<number> {
    return this.metrics?.getCounter(type, target) || 0;
  }

  /**
   * Gets the average latency for a subject, contract or queue.
   */
  async getAverageLatency(target: string | INatsProvider<any>): Promise<number> {
    return this.metrics?.getAverageLatency(target) || 0;
  }

  /**
   * Gets the real-time pending and unacknowledged message counts from NATS.
   */
  async getPendingCount(contract: INatsProvider<any>): Promise<{ pending: number, unacked: number }> {
    return this.mq?.engine.getPendingCount(contract) || { pending: 0, unacked: 0 };
  }
}
