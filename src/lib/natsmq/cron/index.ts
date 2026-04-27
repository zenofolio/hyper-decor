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
      // Create a deterministic bucket key based on the schedule tick
      // This ensures servers with slightly skewed clocks compete for the SAME lock
      const bucket = new Date().toISOString().slice(0, 16); // e.g., 2026-04-27T10:00
      const lockKey = `cron:${meta.options.name}:${bucket}`;
      
      const lockTtl = meta.options.lockTtlMs || 60000; // 1 min default
      
      const acquired = await this.store.acquire(lockKey, 1, lockTtl);
      
      if (!acquired) {
        // Another instance won the race
        return;
      }

      this.metrics.increment("natsmq_cron_started_total", 1, { name: meta.options.name });

      const ctx: CronContext = {
        name: meta.options.name,
        scheduledTime: job.currentRun() || new Date(),
        actualTime: new Date(),
        executionId: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        extendLock: async (ms: number) => {
          // Release and re-acquire immediately to extend
          await this.store.release(lockKey);
          await this.store.acquire(lockKey, 1, ms);
        },
        log: (msg: string) => {
          console.log(`[Cron | ${meta.options.name}] ${msg}`);
        },
        metrics: this.metrics
      };

      try {
        await handler(ctx);
        this.metrics.increment("natsmq_cron_completed_total", 1, { name: meta.options.name });
      } catch (err: unknown) {
        console.error(`[Cron | ${meta.options.name}] Error:`, err);
        this.metrics.increment("natsmq_cron_failed_total", 1, { name: meta.options.name });
      } finally {
        await this.store.release(lockKey);
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
