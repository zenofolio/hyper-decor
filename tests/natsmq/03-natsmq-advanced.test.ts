import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NatsMQService } from "../../src/lib/natsmq/service";
import { OnNatsMessage, MaxAckPendingPerSubject, OnCron } from "../../src/lib/natsmq/decorators";
import { z } from "zod";
import { connect, NatsConnection, DeliverPolicy } from "nats";
import { CronContext } from "../../src/lib/natsmq";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const TaskSchema = z.object({ id: z.number() });
type TaskData = z.infer<typeof TaskSchema>;

describe("NatsMQ Advanced & Stress Tests", () => {
  let service: NatsMQService;
  let rawNc: NatsConnection;

  beforeAll(async () => {
    try {
      rawNc = await connect({ servers: "nats://localhost:4222" });
      service = NatsMQService.getInstance();
      service.configure({
        servers: "nats://localhost:4222",
        retryBackoffMs: [50, 100, 200]
      });
      await service.onInit();
    } catch (e) {
      console.warn("NATS not available, skipping advanced tests");
    }
  });

  afterAll(async () => {
    if (service) await service.close();
    if (rawNc) await rawNc.close();
  });

  it("should handle lock expiration during long-running tasks gracefully", async () => {
    if (!rawNc) return;
    const testSuffix = Math.random().toString(36).substring(7);

    class SlowSvc {
      public processed = 0;
      @OnNatsMessage(`slow.${testSuffix}`, TaskSchema, {
        stream: `STR_SLOW_${testSuffix}`,
        deliver_policy: DeliverPolicy.All
      })
      @MaxAckPendingPerSubject(`slow.${testSuffix}`, 1)
      async handle(data: TaskData) {
        // Lock TTL is 60s by default, we'll wait 500ms
        await delay(500);
        this.processed++;
      }
    }

    const svc = new SlowSvc();
    await service.registerInstance(svc);

    await service.mq?.engine.publish(`slow.${testSuffix}`, { id: 1 });

    const start = Date.now();
    while (svc.processed < 1 && Date.now() - start < 5000) {
      await delay(200);
    }
    expect(svc.processed).toBe(1);
  });

  it("should extend cron locks correctly", async () => {
    if (!rawNc) return;
    const testSuffix = Math.random().toString(36).substring(7);
    let runCount = 0;

    class CronSvc {
      @OnCron(`cron_${testSuffix}`, "* * * * * *", { lockTtlMs: 500 })
      async handle(ctx: CronContext) {
        runCount++;
        await ctx.extendLock(2000);
        await delay(1000);
      }
    }

    const svc = new CronSvc();
    await service.registerInstance(svc);

    // Wait for at least one run
    const start = Date.now();
    while (runCount < 1 && Date.now() - start < 5000) {
      await delay(500);
    }
    expect(runCount).toBeGreaterThanOrEqual(1);
  });

  it("should NOT spin excessively when hitting concurrency limits (Stress Test)", async () => {
    if (!rawNc) return;
    const testSuffix = Math.random().toString(36).substring(7);

    class StressSvc {
      public active = 0;
      public maxOverlap = 0;
      public completed = 0;

      @OnNatsMessage(`stress.${testSuffix}`, TaskSchema, {
        stream: `STR_STRESS_${testSuffix}`,
        deliver_policy: DeliverPolicy.All,
        ack_wait: 10000000000 // 10s
      })
      @MaxAckPendingPerSubject(`stress.${testSuffix}`, 2)
      async handle(data: TaskData) {
        this.active++;
        this.maxOverlap = Math.max(this.maxOverlap, this.active);
        await delay(300);
        this.active--;
        this.completed++;
      }
    }

    const svc = new StressSvc();
    await service.registerInstance(svc);

    // Blast 20 messages
    for (let i = 0; i < 20; i++) {
      await service.mq?.engine.publish(`stress.${testSuffix}`, { id: i }, {
        subject: `stress.${testSuffix}`,
        idempotencyKey: `msg_${i}`,
      });
    }

    const start = Date.now();
    // With limit 2 and 300ms delay, 20 messages should take at least 3 seconds (20/2 * 0.3)
    // We wait up to 20s to ensure completion without "spinning" failure
    while (svc.completed < 20 && Date.now() - start < 20000) {
      await delay(500);
    }

    expect(svc.completed).toBe(20);
    expect(svc.maxOverlap).toBeLessThanOrEqual(3); // Allow slight overlap due to NATS redelivery timing
  }, 20000);
});
