import { describe, it, expect } from "vitest";
import { z } from "zod";
import { OnNatsMessage, MaxAckPendingPerSubject } from "../../src/lib/natsmq/decorators";
import { getNatsMQMeta } from "../../src/lib/natsmq/meta";
import { defineQueue } from "../../src/lib/natsmq/contracts";

describe("NatsMQ Metadata Dynamic Subjects & Fill", () => {
  it("should support dynamic subjects and the fill method for publishing", () => {
    
    const QrQueue = defineQueue("qr");
    // Define with wildcard to accept any job ID
    const QrContract = QrQueue.define("job.*", z.object({ id: z.number() }))
      .withConcurrency("qr.job.*", 10);

    class TestNatsService {
      @OnNatsMessage(QrContract)
      @MaxAckPendingPerSubject("qr.job.*", 2)
      async onAccountCreated(data: any) {
        return data;
      }
    }

    const { subscriptions } = getNatsMQMeta(TestNatsService);
    const sub = subscriptions.get("TestNatsService:onAccountCreated");

    // 1. Verify subscription subject has the wildcard
    expect(sub?.subject).toBe("qr.job.*");

    // 2. Demonstrate the .fill() method for dynamic publishing
    const dynamicContract = QrContract.fill("user_1221");
    
    expect(dynamicContract.subject).toBe("qr.job.user_1221");
    expect(dynamicContract.schema).toBe(QrContract.schema); // Schema is preserved
    
    // 3. Verify concurrency pattern also matches the wildcard
    const qrLimit = sub?.concurrencies.find(c => c.pattern === "qr.job.*");
    expect(qrLimit?.limit).toBe(2);
  });
});
