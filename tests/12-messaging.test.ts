import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { HyperApp, HyperModule, HyperService, OnInit, createApplication, OnMessage, MessageBus } from "../src";
import { container } from "tsyringe";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

@HyperService()
class NotificationService {
  public received: string[] = [];
  public wildcardsReceived: string[] = [];

  @OnMessage("user.created")
  async onUserCreated(data: any) {
    this.received.push(data.name);
  }

  @OnMessage("user.*")
  async onAnyUserEvent(data: any) {
    this.wildcardsReceived.push(data.action);
  }
}

@HyperModule({
  imports: [NotificationService],
})
class MsgModule { }

@HyperApp({
  modules: [MsgModule],
})
class MsgApp {
  async onPrepare() { }
}

describe("Agnostic Messaging Layer", () => {
  it("should handle messages via @OnMessage", async () => {
    const app = await createApplication(MsgApp);
    const service = container.resolve(NotificationService);

    await app.emit("user.created", { name: "John Doe", action: "create" });
    await delay(10); // Give EE a moment to process

    expect(service.received).toContain("John Doe");
    expect(service.wildcardsReceived).toContain("create");

    await app.close();
  });

  it("should handle wildcards like user.*", async () => {
    const app = await createApplication(MsgApp);
    const service = container.resolve(NotificationService);

    await MessageBus.emit("user.deleted", { action: "delete" });
    await delay(10);

    expect(service.wildcardsReceived).toContain("delete");
    expect(service.received).not.toContain("delete");

    await app.close();
  });
});
