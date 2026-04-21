import "reflect-metadata";
import {
  HyperApp,
  HyperModule,
  HyperService,
  OnMessage,
  createApplication,
  NatsTransport,
  RedisTransport,
} from "../src";

/**
 * Worker Config from Environment
 */
const WORKER_ID = process.env.WORKER_ID || "unknown";
const TRANSPORT_TYPE = process.env.TRANSPORT_TYPE || "nats";
const TOPIC = process.env.TOPIC || "test.topic";
const QUEUE_GROUP = process.env.QUEUE_GROUP || undefined;

@HyperService()
class WorkerService {
  @OnMessage(TOPIC, { 
    nats: { queue: QUEUE_GROUP },
    redis: { isStream: false } 
  })
  async handle(data: any) {
    // Notify parent process via IPC
    if (process.send) {
      process.send({
        type: "received",
        workerId: WORKER_ID,
        topic: TOPIC,
        data,
      });
    }
  }
}

@HyperModule({
  imports: [WorkerService],
})
class WorkerModule {}

async function bootstrap() {
  let transport;

  if (TRANSPORT_TYPE === "nats") {
    transport = new NatsTransport({ servers: "nats://localhost:4222" });
  } else if (TRANSPORT_TYPE === "redis") {
    transport = new RedisTransport({ host: "localhost", port: 6379 });
  }

  @HyperApp({
    modules: [WorkerModule],
    transports: transport ? [transport] : [],
  })
  class App {}

  const app = await createApplication(App);
  
  // Signal ready
  if (process.send) {
    process.send({ type: "ready", workerId: WORKER_ID });
  }

  // Keep alive
  process.on("SIGTERM", async () => {
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch((err) => {
  console.error(`Worker ${WORKER_ID} failed:`, err);
  process.exit(1);
});
