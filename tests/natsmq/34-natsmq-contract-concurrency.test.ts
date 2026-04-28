import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NatsMQService } from "../../src/lib/natsmq/service";
import { OnNatsMessage, MaxAckPendingPerSubject } from "../../src/lib/natsmq/decorators";
import { defineQueue } from "../../src/lib/natsmq/contracts";
import { z } from "zod";
import { LocalConcurrencyStore } from "../../src/lib/natsmq/store/local-store";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const name = `contract.concurrency.${Math.random().toString(36).substring(7)}`;
const stream = `str_conc_${Math.random().toString(36).substring(7)}`;

// Correct Contract Definition
const queue = defineQueue();
const TaskContract = queue.define(
  name,
  z.object({ id: z.number() })
).withStream(stream);

describe("NatsMQ Contract-based Concurrency", () => {
  let service: NatsMQService;

  beforeAll(async () => {
    service = NatsMQService.getInstance();
    // In tests, we might need to re-configure if singleton was already used
    // But for a clean test, we just assume it's fresh or we use a unique config
    try {
      service.configure({
        servers: "nats://localhost:4222",
        concurrencyStore: new LocalConcurrencyStore()
      });
    } catch (e) {
      // Already configured, that's fine for this test
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
      @MaxAckPendingPerSubject(TaskContract, 1) // Using Contract!
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

    // Publish 2 messages using the contract
    await service.mq!.engine.publish(TaskContract, { id: 1 });
    await service.mq!.engine.publish(TaskContract, { id: 2 });

    // Wait for completion
    const start = Date.now();
    while (svc.completed < 2) {
      if (Date.now() - start > 5000) break;
      await delay(100);
    }

    expect(svc.completed).toBe(2);
    expect(svc.maxOverlap).toBe(1); // Should have been strictly sequential
  });
});
