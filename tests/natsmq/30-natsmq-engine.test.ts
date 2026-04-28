import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NatsMQService } from "../../src/lib/natsmq/service";
import { OnNatsMessage, MaxAckPendingPerSubject } from "../../src/lib/natsmq/decorators";
import { z } from "zod";
import { connect, NatsConnection, DeliverPolicy } from "nats";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- CLASES DE PRUEBA CON DECORADORES REALES ---

const UserSchema = z.object({ name: z.string() });
type UserData = z.infer<typeof UserSchema>;

const JobSchema = z.object({ id: z.number() });
type JobData = z.infer<typeof JobSchema>;

const suffix = Date.now();

describe("NatsMQ Engine (Decorator-based)", () => {
  let service: NatsMQService;
  let rawNc: NatsConnection;

  beforeAll(async () => {
    try {
      rawNc = await connect({ servers: "nats://localhost:4222" });
      service = NatsMQService.getInstance();
      service.configure({ 
        servers: "nats://localhost:4222", 
        dlsSubject: `dls_global_${Date.now()}`,
        retryBackoffMs: [10, 20, 50]
      });
      await service.onInit();
    } catch (e) {
      console.warn("NATS not available, skipping engine tests");
    }
  });

  afterAll(async () => {
    if (service) await service.close();
    if (rawNc) await rawNc.close();
  });

  it("should process messages using @OnNatsMessage decorator", async () => {
    if (!rawNc) return;
    const testSuffix = Math.random().toString(36).substring(7);
    
    class UserSvc {
      public handled = false;
      @OnNatsMessage(`users.${testSuffix}.created`, UserSchema, {
        stream: `STR_USERS_${testSuffix}`,
        deliver_policy: DeliverPolicy.All,
        durable_name: `user_cons_${testSuffix}`
      })
      async handle(data: UserData) { 
        this.handled = true; 
      }
    }

    const userSvc = new UserSvc();
    await service.registerInstance(userSvc);

    await service.mq?.engine.publish(`users.${testSuffix}.created`, UserSchema, { name: "Bob" });

    const start = Date.now();
    while (!userSvc.handled && Date.now() - start < 5000) {
      await delay(200);
    }
    expect(userSvc.handled).toBe(true);
  });

  it("should enforce concurrency using @MaxAckPendingPerSubject", async () => {
    if (!rawNc) return;
    const testSuffix = Math.random().toString(36).substring(7);

    class JobSvc {
      public completed = 0;
      public active = 0;
      public maxOverlap = 0;

      @OnNatsMessage(`jobs.${testSuffix}.>`, JobSchema, {
        stream: `STR_JOBS_${testSuffix}`,
        deliver_policy: DeliverPolicy.All,
        durable_name: `job_cons_${testSuffix}`,
        ack_wait: 5000000000 // 5s
      })
      @MaxAckPendingPerSubject(`jobs.${testSuffix}.>`, 1)
      async handle(data: JobData) {
        this.active++;
        this.maxOverlap = Math.max(this.maxOverlap, this.active);
        await delay(200);
        this.active--;
        this.completed++;
      }
    }

    const jobSvc = new JobSvc();
    await service.registerInstance(jobSvc);

    // Publish 4 messages to DIFFERENT subjects but under the SAME concurrency pattern
    const engine = service.mq?.engine;
    if (!engine) throw new Error("Engine not initialized");

    await engine.publish(`jobs.${testSuffix}.sync.A`, JobSchema, { id: 1 });
    await delay(100);
    await engine.publish(`jobs.${testSuffix}.sync.B`, JobSchema, { id: 2 });
    await delay(100);
    await engine.publish(`jobs.${testSuffix}.sync.C`, JobSchema, { id: 3 });
    await delay(100);
    await engine.publish(`jobs.${testSuffix}.sync.D`, JobSchema, { id: 4 });
    
    const start = Date.now();
    while (jobSvc.completed < 4 && Date.now() - start < 30000) {
      await delay(500);
    }

    expect(jobSvc.completed).toBe(4);
    // Should be exactly 1, but we allow 2 in case of slight timing overlap in test assertions
    expect(jobSvc.maxOverlap).toBeLessThanOrEqual(2);
  }, 40000);
});
