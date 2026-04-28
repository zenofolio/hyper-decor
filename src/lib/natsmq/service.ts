import "reflect-metadata";
import { container } from "tsyringe";
import { CronContext, NatsMQOptions } from "./types";
import { NatsMQ } from "./index";
import {
  NATSMQ_SUBSCRIPTION_METADATA,
  NATSMQ_CONCURRENCY_METADATA,
  NATSMQ_CRON_METADATA,
  NatsSubscriptionMeta,
  NatsConcurrencyMeta,
  NatsCronMeta
} from "./decorators";
import { JsMsg } from "nats";

export class NatsMQService {
  private static instance: NatsMQService;
  public mq: NatsMQ | null = null;
  private isInitialized = false;

  private constructor() { }

  public static getInstance(): NatsMQService {
    if (!NatsMQService.instance) {
      NatsMQService.instance = new NatsMQService();
    }
    return NatsMQService.instance;
  }

  /**
   * Configures the global MQ instance. Must be called before onInit.
   */
  public configure(options: NatsMQOptions): void {
    if (this.mq) {
      throw new Error("NatsMQService is already configured.");
    }
    console.log(`[Service] 🔧 Configuring MQ with Store: ${options.concurrencyStore ? options.concurrencyStore.constructor.name : 'NONE'}`);
    this.mq = new NatsMQ(options);
    // Register globally in tsyringe so @NatsClient() or constructors can inject it if needed
    container.register(NatsMQ, { useValue: this.mq });
  }

  /**
   * Lifecycle hook to initialize connections, auto-provision streams, 
   * and wire up all decorators across the DI container.
   */
  public async onInit(): Promise<void> {
    if (!this.mq) {
      throw new Error("NatsMQService was not configured. Call configure() first.");
    }
    if (this.isInitialized) return;

    await this.mq.start();
    await this.bootstrapDecorators();

    this.isInitialized = true;
  }

  /**
   * Graceful shutdown of the MQ engine and crons.
   */
  public async close(): Promise<void> {
    if (this.mq) {
      await this.mq.close();
      this.isInitialized = false;
    }
  }

  /**
   * Scans the dependency injection container or prototype chains 
   * to find and register @OnNatsMessage and @OnCron handlers.
   */
  private async bootstrapDecorators() {
    if (!this.mq) return;

    // We scan all registered singletons in the tsyringe container.
    // Tsyringe doesn't have a built-in "getAllTokens" API that is public and stable.
    // However, in a standard HyperApp, controllers and services are instantiated.
    // We assume the user has a way to provide the instances, or we scan Reflect metadata.

    // For this implementation, since tsyringe hides the registry, we rely on the user
    // passing the instances, OR if we are part of HyperApp prepare.helper, it would pass them.
    // For now, let's expose a method to register a specific target instance.
  }

  /**
   * Registers a specific class instance that has NatsMQ decorators.
   */
  public async registerInstance(instance: object): Promise<void> {
    if (!this.mq) throw new Error("MQ not started");

    const target = instance.constructor;

    // 1. Setup NATS Consumers
    const subs: NatsSubscriptionMeta[] = Reflect.getMetadata(NATSMQ_SUBSCRIPTION_METADATA, target) || [];
    for (const sub of subs) {
      let concurrencyMeta: NatsConcurrencyMeta | undefined = Reflect.getMetadata(
        NATSMQ_CONCURRENCY_METADATA,
        instance,
        sub.methodName
      );

      // Si no está en la instancia, buscamos en el constructor (clase)
      if (!concurrencyMeta) {
        concurrencyMeta = Reflect.getMetadata(
          NATSMQ_CONCURRENCY_METADATA,
          target,
          sub.methodName
        );
      }

      if (concurrencyMeta) {
        // Concurrency metadata found
      }

      // Provision stream if it doesn't exist
      await this.mq.engine.provisionStream(sub);

      // Bind the handler with strict typing
      const handler = (instance as Record<string, (data: unknown, msg: JsMsg) => Promise<unknown>>)[sub.methodName];
      if (typeof handler !== 'function') {
        throw new Error(`Handler ${sub.methodName} not found on instance`);
      }
      await this.mq.engine.createPullConsumer(sub, concurrencyMeta, handler.bind(instance));
    }

    // 2. Setup Crons
    const crons: NatsCronMeta[] = Reflect.getMetadata(NATSMQ_CRON_METADATA, target) || [];
    for (const cron of crons) {
      const handler = (instance as Record<string, (ctx: CronContext) => Promise<unknown>>)[cron.methodName];
      if (typeof handler !== 'function') {
        throw new Error(`Cron handler ${cron.methodName} not found on instance`);
      }
      this.mq.cron.schedule(cron, handler.bind(instance));
    }
  }
}
