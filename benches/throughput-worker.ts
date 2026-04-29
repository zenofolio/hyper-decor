import "reflect-metadata";
import { NatsMQService } from "../src/lib/natsmq/service";
import { OnNatsMessage } from "../src/lib/natsmq/decorators";
import { DeliverPolicy } from "nats";
import { z } from "zod";

const JobSchema = z.object({ id: z.number(), isLast: z.boolean().optional() });

class ThroughputWorker {
  private count = 0;

  @OnNatsMessage("bench.throughput", JobSchema, {
    stream: "STR_THROUGHPUT_BENCH",
    deliver_policy: DeliverPolicy.All,
    durable_name: "bench_consumer"
  })
  async handle(data: z.infer<typeof JobSchema>) {
    this.count++;

    if (this.count % 500 === 0) {
      console.log(`[Worker:${process.pid}] processed ${this.count} messages`);
    }

    if (data.isLast) {
      console.log(`[Worker:${process.pid}] ✅ GOT isLast after ${this.count} messages`);
      process.send?.({ type: "done", time: Date.now(), count: this.count });
    }
  }
}

async function main() {
  const service = NatsMQService.getInstance();
  service.configure({ servers: "nats://localhost:4222" });
  await service.onInit();

  const worker = new ThroughputWorker();
  await service.registerInstance(worker);

  console.log(`🚀 Throughput Worker ${process.pid} READY.`);
}

main().catch(console.error);
