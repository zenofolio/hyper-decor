# Distributed Concurrency Control

NatsMQ provides one of the strictest concurrency enforcement mechanisms for distributed workers. It ensures that a specific subject is never processed by more than `N` workers simultaneously across the entire cluster.

## How it Works

NatsMQ uses a dual-layer strategy to manage load:

### 1. Global Locking (Redis)
When a message arrives, the worker attempts to acquire an atomic slot in the `ConcurrencyStore` (Redis). 
- If a slot is available, the worker proceeds.
- If the limit is reached, the worker **backs off**.

### 2. Local Retry Queue (Backoff)
Unlike traditional "aggressive NAKing" which causes high CPU and network overhead, NatsMQ uses a **Local Retry Queue**. 
- If a lock cannot be acquired, the message is held in local memory for a few milliseconds (with exponential backoff).
- This prevents "Nats Storms" where messages bounce between workers infinitely.

## Usage

Use the `@MaxAckPendingPerSubject` decorator. It supports wildcards.

```typescript
class OrderWorker {
  // Only 1 order for the SAME ID can be processed at once in the whole cluster
  @OnNatsMessage("orders.process.*", OrderSchema, { stream: "ORDERS" })
  @MaxAckPendingPerSubject("orders.process.*", 1) 
  async handleOrder(data: any) {
    // ...
  }

  // Only 20 heavy reports can be processed across all servers
  @OnNatsMessage("reports.heavy.>", ReportSchema, { stream: "REPORTS" })
  @MaxAckPendingPerSubject("reports.heavy.>", 20)
  async handleReport(data: any) {
    // ...
  }
}
```

## Scaling
NatsMQ automatically uses **shared durable consumers**. This means:
- If you have 10 instances of a service, NATS will balance the messages among them.
- If an instance crashes, NATS will redeliver the message to another instance after the `ack_wait` timeout.
- The `RedisConcurrencyStore` ensures that even during redelivery, the concurrency limit is strictly respected.
