import { z } from "zod";

// Explicitly export types to avoid ambiguity
export {
  NatsSubscriptionOptions,
  NatsSubscriptionMeta,
  NatsCronMeta,
  NatsConcurrencyMeta,
  INatsProvider,
  CronOptions,
  IConcurrencyStore,
  INatsMetrics,
  NatsMQMetrics,
  NatsMQOptions,
  CronContext
} from "./types";

export * from "./decorators";
export * from "./store/local-store";
export * from "./store/redis-store";
export * from "./engine";
export * from "./metrics";
export * from "./cron";
export * from "./service";

// Explicitly export contracts
export {
  NatsMessageContract,
  ContractFactory,
  defineQueue
} from "./contracts";

import { NatsMQEngine } from "./engine";
import { CronScheduler } from "./cron";
import { DefaultNatsMQMetrics } from "./metrics";
import { NatsMQOptions, NatsMQMetrics } from "./types";
import { LocalConcurrencyStore } from "./store/local-store";
import { JsMsg, RetentionPolicy, StorageType } from "nats";
import { getNatsMQMeta } from "./meta";
import { NatsMQService } from "./service";
import { container } from "tsyringe";
import { SubscriptionTask } from "./types";

export class NatsMQ {
  public engine: NatsMQEngine;
  public cron: CronScheduler;
  public metrics: NatsMQMetrics;

  constructor(options: NatsMQOptions) {
    this.metrics = options.metrics || new DefaultNatsMQMetrics();
    this.engine = new NatsMQEngine({ ...options, metrics: this.metrics });
    this.cron = new CronScheduler(
      options.concurrencyStore || new LocalConcurrencyStore(),
      this.metrics
    );
  }

  /**
   * Bootstraps a NatsMQ application using the @NatsMQApp decorator.
   */
  public static async bootstrap(appClass: any): Promise<NatsMQ> {
    const meta = getNatsMQMeta(appClass);
    if (!meta.appConfig) {
      throw new Error(`Class ${appClass.name} is not a valid @NatsMQApp`);
    }

    const { servers, workers = [], queues = [] } = meta.appConfig;
    const service = NatsMQService.getInstance();

    // Configure if not already configured
    if (!service.mq) {
      service.configure({
        servers: servers || "nats://localhost:4222"
      });
    }

    await service.onInit();

    const allTasks: SubscriptionTask[] = [];

    // 1. Collect global queue tasks
    if (queues.length > 0) {
      for (const queue of queues) {
        const config = queue.getNatsConfig();
        allTasks.push({
          meta: {
            subject: config.subject,
            options: config.options,
            key: `app:global:${config.subject}`,
            methodName: "global",
            className: "App",
            schema: config.schema,
            isRequest: false,
            concurrencies: []
          }
        });
      }
    }

    // 2. Register all workers and collect their tasks
    const instances = [];
    if (workers.length > 0) {
      for (const workerClass of workers) {
        const instance = container.resolve(workerClass);
        instances.push(instance);
        const { tasks, crons } = await service.collectWorkerMetadata(instance);
        allTasks.push(...tasks);
        
        // Schedule crons immediately as they are local to the process
        for (const { meta, handler } of crons) {
          service.mq!.cron.schedule(meta, handler);
        }
      }
    }

    // 3. Batch Provision Infrastructure
    await service.mq!.engine.provisionInfrastructure(allTasks);

    // 4. Activate Consumers
    await service.mq!.engine.activateConsumers(allTasks);

    return service.mq!;
  }

  async start() {
    await this.engine.start();
  }

  async close() {
    this.cron.stopAll();
    await this.engine.close();
  }

  /**
   * Programmatically subscribe to a NATS subject or contract without decorators.
   */
  async subscribe<T>(
    subjectOrProvider: any,
    handler: (data: T, msg: JsMsg) => Promise<any>,
    options: {
      schema?: z.ZodType<T>,
      concurrency?: number,
      stream?: string,
      durable?: string,
      storage?: StorageType,
      retention?: RetentionPolicy
    } = {}
  ): Promise<void> {
    let subject: string;
    let schema: z.ZodType<T>;
    let finalOptions = { ...options };

    if (typeof subjectOrProvider === "string") {
      subject = subjectOrProvider;
      schema = options.schema || (z.any() as any);
    } else {
      const config = (subjectOrProvider as any).getNatsConfig();
      subject = config.subject;
      schema = config.schema;
      finalOptions = {
        stream: config.options.stream,
        durable: config.options.durable_name,
        storage: config.options.storage,
        retention: config.options.retention,
        ...options
      };
    }

    const concurrencies: any[] = [];
    if (options.concurrency) {
      concurrencies.push({ pattern: subject, limit: options.concurrency });
    }

    const meta: any = {
      key: `prog:${subject}`,
      methodName: "handler",
      className: "Programmatic",
      subject,
      schema,
      options: {
        stream: finalOptions.stream || "default_stream",
        durable_name: finalOptions.durable || `cons_${subject.replace(/[^a-zA-Z0-9]/g, '_')}`,
        filter_subject: subject,
        storage: finalOptions.storage,
        retention: finalOptions.retention
      },
      isRequest: false,
      concurrencies
    };

    await this.engine.provisionStream(meta);
    await this.engine.createPullConsumer(meta, concurrencies, (data: unknown, msg: JsMsg) => {
      return handler(data as T, msg);
    });
  }
}
