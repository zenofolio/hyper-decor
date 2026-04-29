# NatsMQ: Distributed Messaging Engine

NatsMQ is the high-performance messaging engine of `hyper-decor`, built on top of **NATS JetStream**. It focuses on type-safety, contract-first design, and cluster-wide concurrency control.

## 1. Contract-First Design

Instead of using strings for subjects, NatsMQ uses **Contracts**. This eliminates "string magic" and ensures producers and consumers are always in sync.

```typescript
import { defineQueue } from "@zenofolio/hyper-decor";
import { z } from "zod";

// 1. Create a Queue Factory
const Orders = defineQueue("orders", { stream: "ORDERS" });

// 2. Define Typed Contracts
export const OrderCreated = Orders.define("created", z.object({ id: z.string() }));

export const GetOrder = Orders.define(
  "get", 
  z.object({ id: z.string() }),
  z.object({ id: z.string(), status: z.string() }) // Response schema
);
```

## 2. Usage with Decorators (Automatic)

NatsMQ supports both **Stage 3** (modern TS) and **Legacy** decorators. When using decorators, the `NatsMQService` automatically discovers and wires up the consumers.

```typescript
@HyperService()
class OrderWorker {
  @OnNatsMessage(OrderCreated)
  @MaxAckPendingPerSubject(OrderCreated, 5) // Cluster-wide concurrency limit
  async handle(data: z.infer<typeof OrderCreated.schema>) {
    console.log("Processing order:", data.id);
    await delay(100);
  }

  @OnNatsRequest(GetOrder)
  async get(req: any) {
    return { id: req.id, status: "shipped" };
  }
}

// Wire it up (returns the DI-resolved instance)
const [worker] = await NatsMQService.getInstance().register(OrderWorker);
```

## 3. Programmatic Usage (No Decorators)

If you prefer to avoid decorators or need dynamic subscriptions, you can use the programmatic API.

```typescript
const service = NatsMQService.getInstance();

// Subscribe manually to a contract
await service.mq.engine.createPullConsumer(
  OrderCreated.getNatsConfig(), 
  [], // No concurrency limits
  async (data, msg) => {
    console.log("Manually received:", data);
    await msg.ack();
  }
);
```

## 4. High-Performance Throughput

NatsMQ is optimized for high-volume workloads, capable of exceeding **30,000 msg/sec**. To achieve maximum performance:

1.  **Parallel Processing**: Avoid `await` in the main consumer loop for non-critical tasks.
2.  **Batching**: NatsMQ automatically pulls messages in batches (default 50) to minimize network roundtrips.
3.  **Local Buffering**: Use the built-in inflight control to balance local task execution with global concurrency limits.

## 5. Distributed Concurrency & Cron

NatsMQ provides absolute mutual exclusion for distributed environments.

### Concurrency Limits
Use `@MaxAckPendingPerSubject` to enforce that only `N` messages of a specific type are processed at any given time across the whole cluster.

### Distributed Cron
Use `@OnCron` to ensure a task runs exactly once in the entire cluster at a specific time, even if multiple servers are running the same service.

```typescript
class BackupService {
  @OnCron("0 0 * * * *") // Every hour
  async runBackup() {
    // Only ONE instance in the whole cluster will execute this.
    // Protected by Redis/Local locks with temporal bucketing.
  }
}
```

## 6. Publishing & Requests

```typescript
const mq = NatsMQService.getInstance().mq;

// 1. Fire and Forget
await mq.engine.publish(OrderCreated, { id: "ORD-123" });

// 2. RPC (Request/Response)
const status = await mq.engine.request(GetOrder, { id: "ORD-123" });
console.log(status.status); // "shipped"
```
