import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { z } from "zod";
import { NatsMQService } from "../../src/lib/natsmq/service";
import { defineQueue } from "../../src/lib/natsmq/contracts";
import { OnNatsMessage, MaxAckPendingPerSubject } from "../../src/lib/natsmq/decorators";
import { LocalConcurrencyStore } from "../../src/lib/natsmq/store/local-store";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const randomId = () => Math.random().toString(36).substring(7);
const STREAM_NAME = `STR_TEST_${randomId()}`;
const QUEUE_PREFIX = `tasks_${randomId()}`;

const Tasks = defineQueue(QUEUE_PREFIX, { stream: STREAM_NAME });
const TaskContract = Tasks.define("job", z.object({ id: z.number() }));

describe("NatsMQ: Contract & Queue Concurrency", () => {
  let service: NatsMQService;

  beforeAll(async () => {
    service = NatsMQService.getInstance();
    try {
      service.configure({
        servers: "nats://localhost:4222",
        concurrencyStore: new LocalConcurrencyStore()
      });
    } catch (e) {
      // Already configured
    }
    await service.onInit();
  });

  afterAll(async () => {
    await service.close();
  });

  it("should enforce concurrency limit using Contract in decorator", async () => {
    class ConcurrencySvc {
      public active = 0;
      public maxOverlap = 0;
      public completed = 0;

      @OnNatsMessage(TaskContract)
      @MaxAckPendingPerSubject(TaskContract, 1) 
      async handle(data: any) {
        this.active++;
        this.maxOverlap = Math.max(this.maxOverlap, this.active);
        await delay(500);
        this.active--;
        this.completed++;
      }
    }

    const svc = new ConcurrencySvc();
    await service.registerInstance(svc);

    await service.mq!.engine.publish(TaskContract, { id: 1 });
    await service.mq!.engine.publish(TaskContract, { id: 2 });

    let wait = 0;
    while (svc.completed < 2 && wait < 100) {
      await delay(100);
      wait++;
    }

    expect(svc.maxOverlap).toBe(1);
    expect(svc.completed).toBe(2);
  });

  it("should allow listening to the ENTIRE queue using the Factory (INatsProvider)", async () => {
    class QueueListenerSvc {
      public receivedSubjects: string[] = [];

      @OnNatsMessage(Tasks) 
      async handleAll(data: any, msg: any) {
        // console.log(`[Test] Received subject: ${msg.subject}`);
        this.receivedSubjects.push(msg.subject);
      }
    }

    const svc = new QueueListenerSvc();
    await service.registerInstance(svc);

    const OtherContract = Tasks.define("other", z.object({ msg: z.string() }));

    // Wait a bit for the consumer to be ready in NATS
    await delay(500);

    await service.mq!.engine.publish(TaskContract, { id: 100 });
    await service.mq!.engine.publish(OtherContract, { msg: "hello" });

    let wait = 0;
    while (svc.receivedSubjects.length < 2 && wait < 100) {
      await delay(100);
      wait++;
    }

    // console.log(`[Test] Total received: ${svc.receivedSubjects.join(", ")}`);
    expect(svc.receivedSubjects).toContain(`${QUEUE_PREFIX}.job`);
    expect(svc.receivedSubjects).toContain(`${QUEUE_PREFIX}.other`);
  });
});
