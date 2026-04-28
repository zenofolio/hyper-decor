# Distributed Concurrency Control

NatsMQ provides one of the strictest concurrency enforcement mechanisms for distributed workers. It ensures that a specific subject is never processed by more than `N` workers simultaneously across the entire cluster.

## 1. Per-Subject Concurrency

Use the `@MaxAckPendingPerSubject` decorator. In 2.0, this is best used with **Contracts** to avoid string magic and ensure consistency.

```typescript
@HyperController("/workers")
class MyWorker {
  // Strict limit of 5 concurrent executions for this specific contract across the CLUSTER
  @OnNatsMessage(OrderCreated)
  @MaxAckPendingPerSubject(OrderCreated, 5) 
  async handle(data: any) {
    // Process...
  }
}
```

### How it works (Backoff Strategy)
Unlike traditional "aggressive NAKing", NatsMQ uses a **Local Retry Queue**. If a lock cannot be acquired, the message is held in local memory for a few milliseconds with exponential backoff. This prevents "NATS Storms" where messages bounce between workers infinitely, wasting CPU and bandwidth.

---

## 2. Distributed Crons (Mutual Exclusion)

The `@OnCron` decorator provides built-in cluster-wide mutual exclusion using the configured `ConcurrencyStore` (Redis).

### Stability Mechanisms
To ensure only one node executes a cron at a given time:
- **Bucket Rounding**: Triggers are aligned to the nearest second. This prevents "double-firing" caused by millisecond-level clock drift between servers.
- **Persistent Locking**: The lock is **not** released immediately after execution. It persists for the duration of the `lockTtlMs` to ensure late-triggering nodes don't find the slot "empty".

```typescript
@HyperService()
class GlobalCron {
  // Guaranteed to run ONLY ONCE per minute across the whole cluster
  @OnCron("cleanup_task", "0 * * * *", { lockTtlMs: 30000 })
  async handleCleanup() {
    console.log("Cleanup started...");
  }
}
```

---

## 3. Storage Strategy

You can choose where the concurrency state is stored:

- **LocalConcurrencyStore**: Perfect for single-instance apps.
- **RedisConcurrencyStore**: Required for distributed clusters.

```typescript
service.configure({
  concurrencyStore: new RedisConcurrencyStore({ redis })
});
```
