import { Cron } from "croner";
import { NatsCronMeta, IConcurrencyStore, NatsMQMetrics, CronContext } from "../types";
import { ILock } from "../../lock/lock";

export class CronScheduler {
  private jobs = new Map<string, any>();

  constructor(
    private store: IConcurrencyStore,
    private metrics?: NatsMQMetrics
  ) {}

  schedule(meta: NatsCronMeta, handler: (ctx: CronContext) => Promise<void>) {
    const job = new Cron(meta.schedule, { timezone: meta.options?.tz }, async (self) => {
      // Logic for cron execution with metrics and locking
      const lockTtl = meta.options?.lockTtlMs || 60000;
      const start = Date.now();
      const executionId = Math.random().toString(36).substring(7);
      
      // Use the current run time from croner for the lock bucket
      const scheduledTime = self.currentRun() || new Date();
      const timeBucket = Math.floor(scheduledTime.getTime() / 1000);

      try {
        // Distributed lock MUST be unique per execution tick to avoid collisions
        let lock = await this.store.acquire([`cron:${meta.name}:${timeBucket}`], lockTtl);
        if (!lock) return;

        try {
          const context: CronContext = {
            name: meta.name,
            scheduledTime: job.nextRun() || new Date(),
            actualTime: new Date(),
            executionId,
            metrics: this.metrics!,
            extendLock: async (ms: number) => {
              if (lock) {
                lock = await this.store.extend(lock, ms);
              }
            },
            log: (msg: string) => console.log(`[Cron:${meta.name}] ${msg}`)
          };

          await handler(context);
          
          if (this.metrics) {
            this.metrics.recordProcessingSuccess(`cron:${meta.name}`, Date.now() - start);
          }
        } finally {
          // NOTE: We do NOT release the lock for crons. 
          // We let it expire by TTL to prevent other workers from running the same tick 
          // if this one finishes very quickly.
        }
      } catch (err) {
        if (this.metrics) {
          this.metrics.recordProcessingError(`cron:${meta.name}`, "cron_error");
        }
        console.error(`[Cron] Error in ${meta.name}:`, err);
      }
    });

    this.jobs.set(meta.key, job);
    console.log(`[Cron] 🕒 Scheduled ${meta.name} (${meta.schedule})`);
  }

  stopAll() {
    const jobsList = Array.from(this.jobs.values());
    for (const job of jobsList) {
      job.stop();
    }
    this.jobs.clear();
  }
}
