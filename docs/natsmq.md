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
const engine = service.getEngine();
await engine.createPullConsumer(
  OrderCreated.getNatsConfig(), 
  [], // No concurrency limits
  async (data, msg) => {
    console.log("Manually received:", data);
    await msg.ack();
  }
);
```

### Accessing the Engine
You can access the `NatsMQEngine` from anywhere using the service. The engine is a **Singleton** consistent across DI and static access:

```typescript
// Via Static Access
const engine = NatsMQService.getEngine();

// Via DI (in a Service/Worker)
constructor(@inject(NatsMQService) private mqService: NatsMQService) {
  const engine = this.mqService.getEngine();
}

await engine.publish(OrderCreated, { id: "ORD-123" });
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
  async run(ctx: CronContext) {
    console.log("Running daily backup...");
    // The engine is available directly in the cron context
    await ctx.engine.publish(BackupStatus, { status: "running" });
  }
}
```

The `CronContext` provides:
- `engine`: The `NatsMQEngine` instance.
- `name`: The name of the cron task.
- `scheduledTime`: When the task was supposed to run.
- `actualTime`: When the task actually started.
- `executionId`: A unique ID for this specific run.
- `extendLock(ms)`: Extend the distributed lock if the task takes longer than expected.
- `log(msg)`: Prefixed logging helper.

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
- **🛡️ Processing Heartbeat**: For long-running tasks, NatsMQ automatically sends `msg.working()` heartbeats every second. This prevents NATS from thinking the worker is dead and redelivering the message to another node while it's still being processed.

## 7. Dead Letter System (DLS) & Reliability

NatsMQ is designed for production-grade reliability. When a message fails repeatedly and reaches its `max_deliver` limit (configured in the contract), NatsMQ protects your queue from "poison messages".

1.  **Automatic DLS**: If a `dlsSubject` is configured in the engine, the failed message is moved there with full metadata (error, attempts, original subject).
2.  **Termination**: After moving to DLS, the original message is explicitly terminated (`msg.term()`) to clear the queue.

```typescript
// Configure DLS in your bootstrap or service initialization
const natsSvc = NatsMQService.getInstance();
natsSvc.configure({
  servers: "...",
  dlsSubject: "system.dls" // All failed messages go here
});
```

## 8. Publishing & Requests

```typescript
const mq = NatsMQService.getInstance().mq;

// 1. Fire and Forget
await mq.engine.publish(OrderCreated, { id: "ORD-123" });

// 2. RPC (Request/Response)
const status = await mq.engine.request(GetOrder, { id: "ORD-123" });
console.log(status.status); // "shipped"
```

## 8. Real-time Monitoring & Metrics

NatsMQ provides a unified API to monitor the state of your messaging system in real-time. This API aggregates data from multiple sources (Business Metrics, NATS JetStream, and Concurrency Store) into a single, semantic call.

### Unified `count` API

Instead of querying multiple providers, use the `mq.count()` method to get a complete snapshot of a specific contract or the entire system.

```typescript
const mq = NatsMQService.getInstance().mq;

// Query multiple dimensions at once for a specific message contract
const stats = await mq.count(['active', 'pending', 'unacked', 'success', 'error'], OrderCreated);

console.log(`Currently processing: ${stats.active}`);
console.log(`Waiting in NATS: ${stats.pending}`);
console.log(`Total successes: ${stats.success}`);
```

### Monitored Dimensions

| Metric | Source | Description |
|--------|--------|-------------|
| `received` | Business | Total number of messages that entered the handler. |
| `success` | Business | Total number of messages successfully processed. |
| `error` | Business | Total number of messages that failed in the handler. |
| `active` | Store | Real-time count of workers currently executing the handler (In-flight). |
| `pending` | NATS | Number of messages waiting in the NATS stream for this consumer. |
| `unacked` | NATS | Number of messages delivered but not yet acknowledged (Ack-pending). |

### Zero-Config Monitoring

NatsMQ uses a **Contract-First Monitoring** approach. By default, it automatically resolves the internal NATS consumer names using standard conventions. This means `mq.count(OrderCreated)` works out-of-the-box without any manual name coordination.

