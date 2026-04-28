import { Cron } from "croner";
import { NatsCronMeta } from "../decorators";
import { IConcurrencyStore, CronContext, NatsMQMetrics } from "../types";

export class CronScheduler {
  private jobs: Cron[] = [];

  constructor(
    private store: IConcurrencyStore,
    private metrics: NatsMQMetrics
  ) { }

  schedule(
    meta: NatsCronMeta,
    handler: (ctx: CronContext) => Promise<unknown>
  ): void {
    const job = new Cron(meta.schedule, { timezone: meta.options.tz }, async () => {
      const scheduledTime = job.currentRun() || new Date();
      // Use Math.round to align to the NEAREST second.
      // This handles the case where one node fires at .999 and another at .001.
      const bucket = Math.round(scheduledTime.getTime() / 1000);
      const lockKey = `cron:${meta.name}:${bucket}`;
      const lockTtl = meta.options.lockTtlMs || 60000;

      try {
        const locked = await this.store.acquire([lockKey], lockTtl);
        if (!locked) return;

        this.metrics.increment("natsmq_cron_started_total", 1, { name: meta.name });

        const ctx: CronContext = {
          name: meta.name,
          scheduledTime,
          actualTime: new Date(),
          executionId: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          extendLock: async (ms: number) => {
            await this.store.extend([lockKey], ms);
          },
          log: (msg: string) => console.log(`[Cron | ${meta.name}] ${msg}`),
          metrics: this.metrics
        };

        await handler(ctx);
        this.metrics.increment("natsmq_cron_completed_total", 1, { name: meta.name });
      } catch (err: any) {
        if (err.name !== "ExecutionError" && err.name !== "ResourceLockedError" && !err.message?.includes("limit")) {
          console.error(`[Cron | ${meta.name}] Error:`, err);
          this.metrics.increment("natsmq_cron_failed_total", 1, { name: meta.name });
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
