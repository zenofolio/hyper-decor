import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { z } from "zod";
import { NatsMQ } from "../../src/lib/natsmq/index";
import { defineQueue } from "../../src/lib/natsmq/contracts";
import { LocalConcurrencyStore } from "../../src/lib/natsmq/store/local-store";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const STREAM_NAME = `STR_PROG_SUITE_MAIN`;

describe("NatsMQ: Programmatic API (No Decorators)", () => {
  let mq: NatsMQ;

  beforeAll(async () => {
    mq = new NatsMQ({
      servers: "nats://localhost:4222",
      concurrencyStore: new LocalConcurrencyStore()
    });
    await mq.start();
  });

  afterAll(async () => {
    await mq.engine.deleteStream(STREAM_NAME);
    await mq.engine.deleteStream(STREAM_NAME + "_CONC");
    await mq.close();
  });

  it("should subscribe and process messages without decorators", async () => {
    const Tasks = defineQueue("prog_basic", { stream: STREAM_NAME });
    const TaskContract = Tasks.define("job", z.object({ id: z.number() }));

    let completed = 0;
    let receivedData: any = null;

    await mq.subscribe(TaskContract, async (data) => {
      receivedData = data;
      completed++;
    });

    await delay(1000);
    await mq.engine.publish(TaskContract, { id: 777 });

    let wait = 0;
    while (completed < 1 && wait < 50) {
      await delay(100);
      wait++;
    }

    expect(completed).toBe(1);
    expect(receivedData.id).toBe(777);
  });

  it("should enforce concurrency programmatically", async () => {
    const Tasks = defineQueue("prog_conc", { stream: STREAM_NAME + "_CONC" });
    const ConcurrencyContract = Tasks.define("heavy", z.object({ n: z.number() }));

    let active = 0;
    let maxOverlap = 0;
    let completed = 0;

    await mq.subscribe(ConcurrencyContract, async () => {
      active++;
      maxOverlap = Math.max(maxOverlap, active);
      await delay(500);
      active--;
      completed++;
    }, { concurrency: 1 });

    await delay(1000);
    await mq.engine.publish(ConcurrencyContract, { n: 1 });
    await mq.engine.publish(ConcurrencyContract, { n: 2 });

    let wait = 0;
    while (completed < 2 && wait < 150) {
      await delay(100);
      wait++;
    }

    expect(maxOverlap).toBe(1);
    expect(completed).toBe(2);
  }, 20000);
});
