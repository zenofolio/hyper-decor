import "reflect-metadata";
import { describe, it, expect } from "vitest";
import {
  HyperApp,
  HyperModule,
  HyperService,
  HyperController,
  Get,
  Res,
  Response,
  OnInit,
  createApplication,
} from "../src";
import { container, inject, delay as tdelay, injectable } from "tsyringe";
import { request } from "./helpers/request";

// Global counter to verify execution
let initCounter = 0;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

@injectable()
@HyperService()
class StaticServiceA implements OnInit {
  async onInit() {
    await delay(5);
    initCounter++;
  }
  getValue() { return "A"; }
}

@injectable()
@HyperService()
class StaticServiceB implements OnInit {
  async onInit() {
    await delay(5);
    initCounter++;
  }
  getValue() { return "B"; }
}

@HyperController("/verify")
class BenchController {
  @Get("/")
  async verify(@Res() res: Response) {
    res.json({
      count: initCounter,
      status: "ok"
    });
  }
}

@HyperModule({
  imports: [StaticServiceA, StaticServiceB],
  controllers: [BenchController]
})
class BenchModule { }

@HyperApp({
  modules: [BenchModule]
})
class App { }

@injectable()
@HyperService()
class CircularA implements OnInit {
  constructor(@inject(tdelay(() => CircularB)) public b: any) { }
  async onInit() {
    await delay(10);
    initCounter++;
  }
  getName() { return "A"; }
}

@injectable()
@HyperService()
class CircularB implements OnInit {
  constructor(@inject(tdelay(() => CircularA)) public a: any) { }
  async onInit() {
    await delay(10);
    initCounter++;
  }
  getName() { return "B"; }
}

@HyperModule({
  imports: [CircularA, CircularB]
})
class CircularModule { }

@HyperApp({
  modules: [CircularModule]
})
class CircularApp { }

describe("Enhanced Performance & Robustness Benchmark", () => {
  it(`should verify service execution and fetch liveliness`, async () => {
    initCounter = 0;
    container.reset();

    const start = Date.now();
    const app = await createApplication(App);
    const duration = Date.now() - start;

    await app.listen(3005);

    // Verify fetch works and services executed via global counter
    const responseText = await request("/verify", undefined, 3005);
    const response = JSON.parse(responseText);

    console.log(`\n✅ LIVELINESS & EXECUTION:`);
    console.log(`- Startup: ${duration}ms`);
    console.log(`- Services Initialized: ${response.count}`);
    console.log(`- Response: ${responseText}`);

    expect(response.status).toBe("ok");
    expect(response.count).toBe(2); // StaticServiceA, StaticServiceB

    await app.close();
  }, 30000);

  it("should handle circular dependencies with delays", async () => {
    container.reset();
    initCounter = 0; // Reset for this clean test

    const app = await createApplication(CircularApp);

    // Resolve classes to verify they exist and are correctly injected
    const a = container.resolve(CircularA);
    const b = container.resolve(CircularB);

    console.log(`\n🔄 CIRCULAR DEP RESULTS:`);
    console.log(`- CircularA sees name: ${a.b.getName()}`);
    console.log(`- CircularB sees name: ${b.a.getName()}`);
    console.log(`- Init Counter: ${initCounter}`);

    expect(a.b.getName()).toBe("B");
    expect(b.a.getName()).toBe("A");
    expect(initCounter).toBe(2); // CircularA, CircularB

    await app.close();
  });
});
