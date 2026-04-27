export * from "./types";
export * from "./decorators";
export * from "./store/local-store";
export * from "./store/redis-store";
export * from "./engine";
export * from "./metrics";
export * from "./cron";

// Optional: A higher level NatsMQ wrapper could be placed here to integrate
// Engine, Metrics, and Cron together in one facade for easier dependency injection.
import { NatsMQEngine } from "./engine";
import { CronScheduler } from "./cron";
import { DefaultNatsMQMetrics } from "./metrics";
import { NatsMQOptions, NatsMQMetrics } from "./types";

export class NatsMQ {
  public engine: NatsMQEngine;
  public cron: CronScheduler;
  public metrics: NatsMQMetrics;

  constructor(options: NatsMQOptions) {
    this.engine = new NatsMQEngine(options);
    this.metrics = new DefaultNatsMQMetrics();
    this.cron = new CronScheduler(
      options.concurrencyStore || new LocalConcurrencyStore(), 
      this.metrics
    );
  }

  async start() {
    await this.engine.start();
  }

  async close() {
    this.cron.stopAll();
    await this.engine.close();
  }
}
