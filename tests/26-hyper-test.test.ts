import { describe, it, expect, vi, beforeEach } from "vitest";
import { HyperTest, HyperService, HyperApp, HyperModule } from "../src";


abstract class IService {
  abstract name(): Promise<String>
}



// 1. Define Services with Lifecycle
const onInitA = vi.fn();
@HyperService()
class ServiceA {
  async onInit() {
    onInitA();
  }
}

const onInitB = vi.fn();
@HyperService({ token: IService })
class ServiceB extends IService {

  constructor(public a: ServiceA) {
    super();
  }

  name(): Promise<String> {
    return Promise.resolve("ServiceB");
  }

  async onInit() {
    onInitB();
  }
}

@HyperModule({
  imports: [
    {
      token: IService,
      useClass: ServiceB
    }
  ]
})
class ModuleTesting { }

@HyperApp({
  modules: [],
  imports: [ModuleTesting]
})
class TestApp { }

describe("HyperTest (Nest-style Testing)", () => {
  beforeEach(() => {
    HyperTest.reset();
  });

  it("should perform ultra-simple one-liner bootstrap", async () => {
    const module = await HyperTest.create(TestApp);
    const serviceB = await module.get(IService) as ServiceB;

    expect(serviceB).toBeDefined();
    expect(serviceB.a).toBeDefined();

    // Verify recursive initialization!
    expect(onInitA).toHaveBeenCalled();
    expect(onInitB).toHaveBeenCalled();
  });

  it("should bootstrap a HyperModule in isolation", async () => {
    const module = await HyperTest.create(ModuleTesting);
    const serviceB = await module.get(IService) as ServiceB;

    expect(serviceB).toBeDefined();
    await expect(serviceB.name()).resolves.toBe("ServiceB");

    // Verify it also triggers lifecycle
    expect(onInitB).toHaveBeenCalled();
  });

  it("should support provider overrides", async () => {
    const mockServiceA = { hello: () => "mocked" };

    const module = await HyperTest.createTestingModule({
      imports: [ServiceB]
    })
      .overrideProvider(ServiceA).useValue(mockServiceA)
      .compile();

    const serviceB = await module.get(ServiceB);
    expect(serviceB.a).toBe(mockServiceA);
    expect((serviceB.a as any).hello()).toBe("mocked");
  });

  it("should create a functional hyper-application", async () => {
    const module = await HyperTest.create(TestApp);
    const app = await module.createHyperApplication();

    expect(app).toBeDefined();
    expect(typeof app.get).toBe("function");
  });
});
