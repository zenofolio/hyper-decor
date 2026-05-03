import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { container, singleton } from "tsyringe";
import { HyperApp, createApplication, OnInit, HyperService } from "../src/index";

// 1. A singleton service to be injected
@HyperService()
class GlobalState {
  public initialized = false;
}

// 2. A bootstrap class
@singleton()
class MyBootstrapClass implements OnInit {
  constructor(private state: GlobalState) {}

  async onInit() {
    this.state.initialized = true;
  }
}

// 3. A pure function bootstrap
const pureFunc = vi.fn(async () => {
  // Do something
});

@HyperApp({
  port: 0, // Random port
  modules: [],
  bootstraps: [
    MyBootstrapClass,
    pureFunc
  ]
})
class MyApp {}

describe("Server Bootstrap Lifecycle", () => {
  it("should execute all bootstrap tasks (classes and functions) on startup", async () => {
    const app = await createApplication(MyApp);
    
    // Verify class-based bootstrap executed and DI worked
    const state = container.resolve(GlobalState);
    expect(state.initialized).toBe(true);

    // Verify function-based bootstrap executed
    expect(pureFunc).toHaveBeenCalled();

    await app.close();
  });
});
