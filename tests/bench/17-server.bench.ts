import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { HyperApp, HyperModule, HyperService, OnInit, createApplication } from "../../src";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Simulate many services with artificial delays
function createMockService(id: number, delayMs: number) {
  @HyperService()
  class MockService implements OnInit {
    async onInit() {
      await delay(delayMs);
      // console.log(`Service ${id} initialized`);
    }
  }
  return MockService;
}

const SERVICE_COUNT = 50;
const DELAY_PER_SERVICE = 10; // 10ms per service

const services = Array.from({ length: SERVICE_COUNT }, (_, i) => createMockService(i, DELAY_PER_SERVICE));

@HyperModule({
  path: "/bench",
  imports: services,
})
class BenchModule { }

@HyperApp({
  modules: [BenchModule],
})
class BenchApp { }

describe("Startup Benchmark", () => {
  it(`should measure startup time for ${SERVICE_COUNT} services with ${DELAY_PER_SERVICE}ms delay each`, async () => {
    const start = Date.now();
    const app = await createApplication(BenchApp);
    const end = Date.now();
    const duration = end - start;

    console.log(`\n🚀 Startup duration: ${duration}ms`);
    console.log(`📈 Expected sequential: ~${SERVICE_COUNT * DELAY_PER_SERVICE}ms`);
    console.log(`📉 Expected parallel: ~${DELAY_PER_SERVICE}ms (plus overhead)`);

    expect(duration).toBeGreaterThan(0);
    await app.close();
  });
});
