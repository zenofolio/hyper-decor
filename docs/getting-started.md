# Getting Started

This guide shows you how to build a complete application using `hyper-decor`.

## 1. Installation

```bash
npm install @zenofolio/hyper-decor nats ioredis zod reflect-metadata
```

## 2. Full Application Example

Here is a complete structure including a Module, a Controller with REST, and a Service with NATS messaging.

```typescript
import { 
  HyperApp, HyperModule, HyperController, HyperService,
  Get, Post, Body, OnNatsMessage, NatsMQService 
} from "@zenofolio/hyper-decor";

// --- 1. Define a Service with NATS logic ---
@HyperService()
class OrderService {
  @OnNatsMessage("orders.created")
  async handleNewOrder(data: any) {
    console.log("Order received via NATS:", data);
  }

  async create(data: any) {
    // Business logic
    return { id: "123", ...data };
  }
}

// --- 2. Define a Controller for REST ---
@HyperController("/orders")
class OrderController {
  constructor(private orderSvc: OrderService) {}

  @Get("/:id")
  async getOrder() {
    return { id: "123", status: "ok" };
  }

  @Post("/")
  async createOrder(@Body() body: any) {
    return this.orderSvc.create(body);
  }
}

// --- 3. Organize into a Module ---
@HyperModule({
  controllers: [OrderController],
  providers: [OrderService]
})
class OrderModule {}

// --- 4. Bootstrap the Application ---
@HyperApp({
  modules: [OrderModule],
  bootstraps: [
    async () => {
      // Configure NATS using the unified NatsMQService singleton
      const natsSvc = NatsMQService.getInstance();
      natsSvc.configure({ servers: "nats://localhost:4222" });
      await natsSvc.onInit();
      console.log("🚀 NATS Messaging Ready!");
    }
  ]
})
class MainApp { }

// Start the server
const app = await createApplication(MainApp);
await app.listen(3000);
```

## 3. Distributed Setup (Redis & NATS)

For production, you usually want to configure a `ConcurrencyStore` to handle distributed locks and metrics.

```typescript
const natsSvc = NatsMQService.getInstance();
natsSvc.configure({
  servers: "nats://localhost:4222",
  concurrencyStore: new RedisConcurrencyStore({ redis }),
  metrics: new RedisMetrics({ redis })
});
```
