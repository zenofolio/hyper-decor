import { container } from "tsyringe";
import { NatsMQ } from "./index";
import {
  NatsMQOptions,
  NatsSubscriptionMeta,
  NatsMQMetadata,
  NatsMQMetrics,
  INatsProvider,
  SubscriptionTask,
  NatsCronMeta,
  NatsMQWorkerOptions,
  CronContext
} from "./types";
import { getNatsMQMeta } from "./meta";
import { NatsMQEngine } from "./engine";

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

  public static getEngine(): NatsMQEngine {
    return this.getInstance().getEngine();
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
    if (!this.mq) {
      throw new Error("NatsMQ not configured. Call configure() first.");
    }

    const instances = [];
    const allTasks: SubscriptionTask[] = [];
    const allCrons: { meta: NatsCronMeta, handler: any }[] = [];

    for (const target of targets) {
      let instance: any = target;
      if (typeof target === "function") {
        instance = container.resolve(target as new (...args: any[]) => any);
      }
      instances.push(instance);

      const { tasks, crons } = await this.collectWorkerMetadata(instance);
      allTasks.push(...tasks);
      allCrons.push(...crons);
    }

    // 1. Batch Infrastructure
    await this.mq.engine.provisionInfrastructure(allTasks);

    // 2. Activate Consumers
    await this.mq.engine.activateConsumers(allTasks);

    // 3. Setup Crons
    for (const { meta, handler } of allCrons) {
      this.mq.cron.schedule(meta, this.mq?.engine, handler);
    }

    return instances;
  }

  /**
   * Discovers and collects all metadata for a worker instance without activating anything.
   */
  public async collectWorkerMetadata(instance: any): Promise<{ tasks: SubscriptionTask[], crons: { meta: NatsCronMeta, handler: any }[] }> {
    const tasks: SubscriptionTask[] = [];
    const crons: { meta: NatsCronMeta, handler: any }[] = [];

    // 1. Get class-level metadata
    const classMeta = getNatsMQMeta(instance.constructor);
    const combinedMeta: NatsMQMetadata = {
      subscriptions: new Map(classMeta.subscriptions),
      crons: new Map(classMeta.crons),
      workerOptions: classMeta.workerOptions,
      appConfig: classMeta.appConfig
    };

    // 2. Discover method-level metadata (for Stage 3 decorators)
    const prototype = Object.getPrototypeOf(instance);
    if (prototype) {
      const methods = Object.getOwnPropertyNames(prototype);
      for (const methodName of methods) {
        if (methodName === "constructor") continue;
        const method = instance[methodName];
        if (typeof method === "function") {
          const methodMeta = getNatsMQMeta(method);
          if (methodMeta.subscriptions.size > 0) {
            for (const [key, sub] of Array.from(methodMeta.subscriptions.entries())) {
              combinedMeta.subscriptions.set(key, sub);
            }
          }
          if (methodMeta.crons.size > 0) {
            for (const [key, cron] of Array.from(methodMeta.crons.entries())) {
              combinedMeta.crons.set(key, cron);
            }
          }
        }
      }
    }

    const classConfig: NatsMQWorkerOptions = combinedMeta.workerOptions || {};

    // 3. Process Subscriptions
    for (const sub of Array.from(combinedMeta.subscriptions.values())) {
      let resolvedSub: NatsSubscriptionMeta = { ...sub };
      const handler = instance[sub.methodName].bind(instance);

      if (classConfig.queue) {
        const factory = classConfig.queue as any;
        const qConfig = factory.getNatsConfig();

        // Inherit stream if not defined
        resolvedSub.options = {
          ...qConfig.options,
          ...resolvedSub.options,
          stream: resolvedSub.options.stream || qConfig.options.stream
        };

        // If it's a factory, ensure the subject is resolved/prefixed
        if (factory.define && (!sub.subject.includes('.') || !sub.subject.startsWith(factory.prefix || ""))) {
          const contract = factory.define(sub.subject, sub.schema, undefined, sub.options);
          const config = contract.getNatsConfig();
          resolvedSub.subject = config.subject;
          resolvedSub.options.filter_subject = config.subject;
        }
      }

      tasks.push({ meta: resolvedSub, handler });
    }

    // 4. Process Crons
    for (const cron of Array.from(combinedMeta.crons.values())) {
      const handler = instance[cron.methodName].bind(instance);
      crons.push({ meta: cron, handler });
    }

    return { tasks, crons };
  }

  /**
   * Compatibility alias for register.
   */
  public async registerInstance(instance: any): Promise<void> {
    await this.register(instance);
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

  /**
   * Gets the NatsMQ engine instance.
   * Throws an error if the engine is not initialized.
   */
  public getEngine(): NatsMQEngine {
    if (!this.mq || !this.mq.engine) {
      throw new Error("NatsMQ Engine not initialized. Call configure() and onInit() first.");
    }
    return this.mq.engine;
  }
}
