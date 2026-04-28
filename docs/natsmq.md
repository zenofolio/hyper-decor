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

## 2. Fluent Configuration

Contracts can be specialized using a chainable API.

```typescript
export const HighPriorityJob = Orders.define("urgent", JobSchema)
  .withMaxDeliver(10)          // Custom retries
  .withDurable("urgent_proc")  // Specific durable consumer name
  .withStream("VIP_JOBS");     // Different stream for this specific subject
```

## 3. Subscribing to Messages

Use `@OnNatsMessage` or `@OnNatsRequest` (for RPC) with your contracts.

```typescript
@HyperService()
class OrderWorker {
  @OnNatsMessage(OrderCreated)
  async handle(data: any) {
    console.log("New order:", data.id);
  }

  @OnNatsRequest(GetOrder)
  async get(req: any) {
    return { id: req.id, status: "processing" };
  }
}
```

## 4. Cluster-Wide Concurrency

Enforce strict limits on how many workers can process a specific subject at the same time across your entire infrastructure.

```typescript
@OnNatsMessage(OrderCreated)
@MaxAckPendingPerSubject(OrderCreated, 1) // Only 1 worker at a time for this contract
async process(order: any) {
  // Safe from race conditions
}
```

## 5. Publishing

```typescript
const service = NatsMQService.getInstance();

// Simple emit
await service.mq.engine.publish(OrderCreated, { id: "123" });

// RPC Request (Typed response)
const result = await service.mq.engine.request(GetOrder, { id: "123" });
```
