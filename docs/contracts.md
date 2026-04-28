# Contract-First Messaging

To avoid "String Magic" (hardcoded subject names) and ensure consistency between producers and consumers, NatsMQ promotes a **Contract-First** approach.

## 1. Defining a Queue Contract

Use `defineQueue` to group related messages under a shared prefix and stream.

```typescript
import { defineQueue } from "@zenofolio/hyper-decor";
import { z } from "zod";

// Shared contract definition
export const NotificationsQueue = defineQueue("notifications.>", { stream: "NOTIFICATIONS" });

export const EmailContract = NotificationsQueue.define(
  "email", 
  z.object({ to: z.string(), body: z.string() })
);

export const SmsContract = NotificationsQueue.define(
  "sms", 
  z.object({ phone: z.string(), text: z.string() })
);
```

## 2. Using Contracts in Workers

Instead of strings and schemas, just pass the contract to the decorator.

```typescript
class NotificationWorker {
  @OnNatsMessage(EmailContract)
  async handleEmail(data: z.infer<typeof EmailContract.schema>) {
    // data is already typed as { to: string, body: string }
  }
}
```

## 3. Publishing with Contracts

The engine provides a strongly-typed `publish` method that understands contracts.

```typescript
// Type-safe publishing
await engine.publish(EmailContract, {
  to: "user@example.com",
  body: "Welcome!"
});
```

### Benefits

- **Single Source of Truth**: Change the subject or schema in one place, and the whole system (producers & consumers) stays in sync.
- **Auto-Completion**: No more typos in subject strings.
- **Tree-Shaking**: Import only the specific contracts you need.
- **Discoverability**: One file can define the entire messaging surface of your system.
