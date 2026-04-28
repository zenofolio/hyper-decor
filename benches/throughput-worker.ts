import "reflect-metadata";
import { NatsMQService } from "../src/lib/natsmq/service";
import { MaxAckPendingPerSubject, OnNatsMessage } from "../src/lib/natsmq/decorators";
import { connect, JSONCodec, DeliverPolicy } from "nats";
import { z } from "zod";

const JobSchema = z.object({ id: z.number(), isLast: z.boolean().optional() });

class ThroughputWorker {
  private jc = JSONCodec();

  @OnNatsMessage("bench.throughput", JobSchema, {
    stream: "STR_BENCH",
    deliver_policy: DeliverPolicy.All,
    durable_name: "bench_consumer"
  })
  @MaxAckPendingPerSubject("bench.throughput", 10)
  async handle(data: z.infer<typeof JobSchema>) {
    if (data.isLast) {
      const nc = await connect({ servers: "nats://localhost:4222" });
      await nc.publish("bench.done", this.jc.encode({ time: Date.now() }));
      await nc.close();
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
