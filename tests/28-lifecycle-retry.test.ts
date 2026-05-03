import "reflect-metadata";
import { describe, it, expect, beforeEach } from "vitest";
import { container, singleton } from "tsyringe";
import { createApplication } from "../src/common/bootstrap";
import { HyperApp, OnInit } from "../src/lib/server/decorators";
import { isInitialized } from "../src/__internals/helpers/lifecycle.helper";

import { ILogger, InternalLogger, LOGGER_TOKEN } from "../src/common/logger";

@singleton()
class RetryService implements OnInit {
  static callCount = 0;
  static shouldFail = true;
  id = Math.random();

  async onInit() {
    RetryService.callCount++;
    if (RetryService.shouldFail) {
      throw new Error("Init Failed!");
    }
  }
}

@HyperApp({
  imports: [RetryService],
  modules: []
})
class RetryApp { }

describe("Lifecycle Initialization Retry", () => {
  it("should allow retrying onInit if it failed previously", async () => {
    container.reset();
    container.register(LOGGER_TOKEN, { useClass: InternalLogger });
    container.registerSingleton(RetryService);
    RetryService.callCount = 0;
    RetryService.shouldFail = true;

    // Resolve instance once - this will be Instance #1
    const instance = container.resolve(RetryService);

    // First attempt: should fail
    try {
      await createApplication(RetryApp);
    } catch (err) {
      expect(err.message).toBe("Init Failed!");
    }

    expect(RetryService.callCount).toBe(1);
    expect(isInitialized(instance)).toBe(false);

    // Second attempt: make it succeed
    RetryService.shouldFail = false;
    await createApplication(RetryApp);

    expect(RetryService.callCount).toBe(2);
    expect(isInitialized(instance)).toBe(true);

    // Third attempt: should NOT call onInit again
    await createApplication(RetryApp);
    expect(RetryService.callCount).toBe(2);
  });
});
