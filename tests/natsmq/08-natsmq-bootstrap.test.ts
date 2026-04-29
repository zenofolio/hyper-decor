import "reflect-metadata";
import { describe, it, expect, afterAll } from "vitest";
import { z } from "zod";
import { singleton, container } from "tsyringe";
import { NatsMQ, NatsMQWorker, OnNatsMessage, NatsMQApp, MaxAckPendingPerSubject } from "../../src/lib/natsmq/index";
import { defineQueue } from "../../src/lib/natsmq/contracts";
import { JsMsg, Msg } from "nats";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const STREAM_NAME = `STR_BOOTSTRAP_SUITE`;
const Tasks = defineQueue("boot_tasks", { stream: STREAM_NAME });

const JobSchema = z.object({ id: z.number() });
type JobData = z.infer<typeof JobSchema>;

const TaskJob = Tasks.define("job.>", JobSchema);

@singleton()
@NatsMQWorker(Tasks)
class BootWorker {
  public received: JobData[] = [];
  public active = 0;
  public maxOverlap = 0;

  @OnNatsMessage(TaskJob)
  @MaxAckPendingPerSubject(TaskJob, 1)
  async handleJob(data: JobData, msg: JsMsg) {

    console.log(msg.subject)
    this.active++;
    this.maxOverlap = Math.max(this.maxOverlap, this.active);
    this.received.push(data);
    await delay(500);
    this.active--;
  }
}

@NatsMQApp({
  servers: "nats://localhost:4222",
  workers: [BootWorker]
  // queues: [Tasks] -> Removed redundancy: Tasks is already provisioned via BootWorker
})
class MyBootApp { }

describe("NatsMQ: Bootstrap Architecture", () => {
  let mq: NatsMQ;

  afterAll(async () => {
    if (mq) {
      await mq.engine.deleteStream(STREAM_NAME);
      await mq.close();
    }
  });

  it("should bootstrap the entire app and process messages correctly", async () => {
    // 1. One line to rule them all
    mq = await NatsMQ.bootstrap(MyBootApp);

    // Wait for consumer propagation
    await delay(2000);

    // 2. Publish using the PRE-DEFINED contract (No redundancy)
    await mq.engine.publish(TaskJob, { id: 1 });
    await mq.engine.publish(TaskJob.fill("user_1212"), { id: 2 });

    // 3. Resolve the worker instance (Singleton ensures same instance)
    const worker = container.resolve(BootWorker);

    let wait = 0;
    while (worker.received.length < 2 && wait < 150) {
      await delay(100);
      wait++;
    }

    expect(worker.received.length).toBe(2);
    expect(worker.maxOverlap).toBe(1);
  }, 25000);
});
