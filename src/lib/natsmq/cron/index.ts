import { Cron } from "croner";
import { NatsCronMeta } from "../decorators";
import { IConcurrencyStore, CronContext, NatsMQMetrics } from "../types";

export class CronScheduler {
  private jobs: Cron[] = [];

  constructor(
    private store: IConcurrencyStore,
    private metrics: NatsMQMetrics
  ) {}

  schedule(
    meta: NatsCronMeta, 
    handler: (ctx: CronContext) => Promise<unknown>
  ): void {
    const job = new Cron(meta.schedule, async () => {
      const now = new Date();
      const bucket = now.toISOString().slice(0, 19);
      const lockKey = `cron:${meta.options.name}:${bucket}`;
      const lockTtl = meta.options.lockTtlMs || 60000;

      try {
        await this.store.using([lockKey], lockTtl, async (signal) => {
          this.metrics.increment("natsmq_cron_started_total", 1, { name: meta.options.name });

          const ctx: CronContext = {
            name: meta.options.name,
            scheduledTime: job.currentRun() || new Date(),
            actualTime: new Date(),
            executionId: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            extendLock: async (ms: number) => {
              // Signal that we want to extend is not directly supported by ILock yet via ctx
              // but we can just use the underlying signal if we pass it
            },
            log: (msg: string) => console.log(`[Cron | ${meta.options.name}] ${msg}`),
            metrics: this.metrics
          };

          await handler(ctx);
          this.metrics.increment("natsmq_cron_completed_total", 1, { name: meta.options.name });
        });
      } catch (err: any) {
        if (err.name !== "ExecutionError" && err.name !== "ResourceLockedError" && !err.message?.includes("limit")) {
          console.error(`[Cron | ${meta.options.name}] Error:`, err);
          this.metrics.increment("natsmq_cron_failed_total", 1, { name: meta.options.name });
        }
      }
    });

    this.jobs.push(job);
  }

  stopAll(): void {
    for (const job of this.jobs) {
      job.stop();
    }
  }
}
