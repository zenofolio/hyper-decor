# Getting Started with NatsMQ

NatsMQ is a high-performance, distributed message queue engine built on top of NATS JetStream, featuring strict concurrency control and type safety.

## 1. Installation

Ensure you have the peer dependencies installed:

```bash
npm install nats ioredis zod reflect-metadata
```

## 2. Basic Configuration

The core of the system is the `NatsMQService`. You should configure it at the entry point of your application.

```typescript
import { NatsMQService, RedisConcurrencyStore, RedisMetrics } from "@zenofolio/hyper-decor";
import { Redis } from "ioredis";

async function bootstrap() {
  const redis = new Redis("redis://localhost:6379");
  
  const service = NatsMQService.getInstance();
  service.configure({
    servers: "nats://localhost:4222",
    concurrencyStore: new RedisConcurrencyStore({ redis }),
    metrics: new RedisMetrics({ redis })
  });

  await service.onInit();
}
```

## 3. Defining a Worker

Use decorators to subscribe to subjects. NatsMQ automatically handles stream provisioning and consumer group balancing.

```typescript
import { OnNatsMessage, MaxAckPendingPerSubject } from "@zenofolio/hyper-decor";
import { z } from "zod";

const UserSchema = z.object({ id: z.string(), name: z.string() });

class UserWorker {
  @OnNatsMessage("users.created", UserSchema, { stream: "USERS" })
  @MaxAckPendingPerSubject("users.created", 5) // Strict limit of 5 concurrent users across the cluster
  async handleUser(data: z.infer<typeof UserSchema>) {
    console.log(`Processing user: ${data.name}`);
    // Do work...
  }
}

// Register the worker instance
service.registerInstance(new UserWorker());
```

## 4. Publishing Messages

Validation happens at the source. If the data doesn't match the schema, the promise will reject before reaching NATS.

```typescript
const engine = service.mq.engine;

await engine.publish("users.created", UserSchema, {
  id: "123",
  name: "John Doe"
});
```

---

Next: [Learn about Contracts](./contracts.md) to eliminate "String Magic".
