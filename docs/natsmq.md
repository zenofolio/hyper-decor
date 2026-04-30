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

## 4. Distributed Concurrency & Cron

NatsMQ provides absolute mutual exclusion for distributed environments.

### Concurrency Limits
Use `@MaxAckPendingPerSubject` to enforce that only `N` messages of a specific type are processed at any given time across the whole cluster.

### Distributed Cron
Use `@OnCron` to ensure a task runs exactly once in the entire cluster at a specific time, even if multiple servers are running the same service.

```typescript
@HyperService()
class BackupService {
  @OnCron("Daily Backup", "0 0 * * *")
  async run() {
    console.log("Running daily backup...");
  }
}
```

## 5. Advanced NATS Options (Inflight & Delivery)

NatsMQ allows you to tune the underlying **NATS JetStream Consumer** directly through the contract fluent API.

| Method | Description | NATS Key |
|--------|-------------|----------|
| `.withMaxInflight(n)` | Max messages pending ACK (Inflight) | `max_ack_pending` |
| `.withMaxDeliver(n)` | Max delivery attempts before failing | `max_deliver` |
| `.withStorage(type, [retention])` | Set Stream Storage (Memory/File) and Retention | `storage`, `retention` |
| `.withOptions(obj)` | Pass any NATS `ConsumerConfig` | Mixed |

```typescript
// Configure a contract with strict limits
const HeavyTask = Orders.define("process")
  .withMaxInflight(10) // Only pull 10 messages from NATS at a time
  .withMaxDeliver(5)   // Give up after 5 failed attempts
  .withStorage(StorageType.Memory) // Use in-memory storage for this stream
  .withOptions({ 
     ack_wait: 30000,   // Wait 30s for ACK
     max_messages: 5    // Pull in batches of 5
  });
```

> [!WARNING]
> **Stream Storage Immutability**: NATS Stream storage type (`File` vs `Memory`) can only be set during stream creation. If you attempt to change the storage type of an existing stream through a contract, NatsMQ will ignore the change in the update cycle to avoid errors.

> [!TIP]
> **Max Inflight vs Global Concurrency**: `withMaxInflight` controls how many messages NATS will send to a single worker. `@MaxAckPendingPerSubject` controls how many workers in the **entire cluster** can process a specific subject simultaneously.

## 6. High-Performance Throughput

NatsMQ is optimized for high-volume workloads (>30,000 msg/sec). 

- **Pull Consumption**: Unlike Push consumers, NatsMQ uses Pull, preventing worker saturation by only requesting messages when it has local capacity.
- **Inflight Control**: NatsMQ pulls messages in batches (customizable via `max_messages`) and processes them in parallel while respecting your concurrency limits.
- **NAK Storm Protection**: If a worker hits a global limit, it won't "NAK storm" NATS; instead, it uses a smart local retry loop with jitter to wait for the next available slot within its local inflight buffer.

## 7. Publishing & Requests

```typescript
const mq = NatsMQService.getInstance().mq;

// 1. Fire and Forget
await mq.engine.publish(OrderCreated, { id: "ORD-123" });

// 2. RPC (Request/Response)
const status = await mq.engine.request(GetOrder, { id: "ORD-123" });
console.log(status.status); // "shipped"
```

