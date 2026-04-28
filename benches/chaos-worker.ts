import "reflect-metadata";
import { NatsMQService } from "../src/lib/natsmq/service";
import { OnNatsMessage } from "../src/lib/natsmq/decorators";
import { connect, JSONCodec, DeliverPolicy } from "nats";
import { z } from "zod";

const JobSchema = z.object({ id: z.number() });

class ChaosWorker {
  @OnNatsMessage("chaos.jobs", JobSchema, {
    stream: "STR_CHAOS",
    deliver_policy: DeliverPolicy.All,
    durable_name: "chaos_consumer", 
    ack_wait: 2000000000 // 2s
  })
  async handle(data: z.infer<typeof JobSchema>) {
    // Simulamos trabajo aleatorio entre 10ms y 60ms
    const delay = Math.floor(Math.random() * 50) + 10;
    await new Promise(r => setTimeout(r, delay));
    
    // Reportamos éxito a través de NATS para que el coordinador lo vea antes del SIGKILL
    const nc = await connect({ servers: "nats://localhost:4222" });
    const jc = JSONCodec();
    await nc.publish("chaos.stats", jc.encode({ worker: process.pid, jobId: data.id }));
    await nc.close();
  }
}

async function main() {
  const service = NatsMQService.getInstance();
  service.configure({ servers: "nats://localhost:4222" });
  await service.onInit();
  
  const worker = new ChaosWorker();
  await service.registerInstance(worker);
  
  console.log(`Worker ${process.pid} ready.`);
}

main().catch(console.error);
