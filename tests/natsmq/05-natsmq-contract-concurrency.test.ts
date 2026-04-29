import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { z } from "zod";
import { NatsMQService } from "../../src/lib/natsmq/service";
import { defineQueue } from "../../src/lib/natsmq/contracts";
import { OnNatsMessage, MaxAckPendingPerSubject, NatsMQApp } from "../../src/lib/natsmq/decorators";
import { LocalConcurrencyStore } from "../../src/lib/natsmq/store/local-store";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const STREAM_NAME_1 = `STR_CONC_1`;
const STREAM_NAME_2 = `STR_CONC_2`;
const QUEUE_PREFIX = `tasks_suite`;

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
    if (service.mq) {
      await service.mq.engine.deleteStream(STREAM_NAME_1);
      await service.mq.engine.deleteStream(STREAM_NAME_2);
    }
    await service.close();
  });

  it("should enforce concurrency limit using Contract in decorator", async () => {
    const Tasks = defineQueue(QUEUE_PREFIX + "_1", { stream: STREAM_NAME_1 });
    const TaskContract = Tasks.define("job", z.object({ id: z.number() }));

    @NatsMQApp({ queues: [Tasks] })
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

    const [svc] = await service.register(ConcurrencySvc);

    await service.mq!.engine.publish(TaskContract, { id: 1 });
    await service.mq!.engine.publish(TaskContract, { id: 2 });

    let wait = 0;
    while (svc.completed < 2 && wait < 150) {
      await delay(100);
      wait++;
    }

    expect(svc.maxOverlap).toBe(1);
    expect(svc.completed).toBe(2);
  }, 20000);

  it("should allow listening to the ENTIRE queue using the Factory (INatsProvider)", async () => {
    const Tasks = defineQueue(QUEUE_PREFIX + "_2", { stream: STREAM_NAME_2 });
    const TaskContract = Tasks.define("job", z.object({ id: z.number() }));
    const OtherContract = Tasks.define("other", z.object({ msg: z.string() }));

    @NatsMQApp({ queues: [Tasks] })
    class QueueListenerSvc {
      public receivedSubjects: string[] = [];

      @OnNatsMessage(Tasks)
      async handleAll(data: any, msg: any) {
        this.receivedSubjects.push(msg.subject);
      }
    }

    const [svc] = await service.register(QueueListenerSvc);

    await delay(1000);

    await service.mq!.engine.publish(TaskContract, { id: 100 });
    await service.mq!.engine.publish(OtherContract, { msg: "hello" });

    let wait = 0;
    while (svc.receivedSubjects.length < 2 && wait < 100) {
      await delay(100);
      wait++;
    }

    expect(svc.receivedSubjects).toContain(`${QUEUE_PREFIX}_2.job`);
    expect(svc.receivedSubjects).toContain(`${QUEUE_PREFIX}_2.other`);
  }, 15000);
});
