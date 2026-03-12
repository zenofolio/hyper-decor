import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import {
  HyperApp,
  HyperModule,
  HyperService,
  HyperController,
  Get,
  OnInit,
  createApplication,
  getAppTree,
  IHyperHooks
} from "../src";
import { container } from "tsyringe";

@HyperService()
class SubService {
  async onInit() { }
}

@HyperController("/test")
class TestController {
  @Get("/hello")
  async hello() {
    return "world";
  }
}

@HyperModule({
  path: "/mod",
  imports: [SubService],
  controllers: [TestController]
})
class TestModule { }

@HyperApp({
  prefix: "/api",
  modules: [TestModule]
})
class App { }

describe("Enhanced Application Tree", () => {
  it("should generate a complete tree with full paths and services", async () => {
    const tree = getAppTree(App);

    // Verify Root
    expect(tree.app.fullPath).toBe("/api");

    // Verify Module
    const mod = tree.modules['TestModule'];
    expect(mod).toBeDefined();
    expect(mod.fullPath).toBe("/api/mod");
    expect(mod.services).toContain(SubService);

    // Verify Controller
    const ctrl = mod.controllers['TestController'];
    expect(ctrl).toBeDefined();
    expect(ctrl.fullPath).toBe("/api/mod/test");

    // Verify Route
    const route = ctrl.routes[0];
    expect(route.fullPath).toBe("/api/mod/test/hello");
    expect(route.method).toBe("get");

    console.log("✅ ENHANCED TREE VERIFIED");
  });
});

@HyperService()
class HookService implements OnInit {
  public state: string = "initial";
  async onInit() {
    this.state = "initialized";
  }
}

describe("Lifecycle Hooks", () => {
  it("should trigger onBeforeInit and onAfterInit hooks", async () => {
    const onBefore = vi.fn((instance, token, context) => {
      if (instance instanceof HookService) {
        instance.state = "before";
        expect(context.type).toBeDefined();
      }
    });

    const onAfter = vi.fn((instance, token, context) => {
      if (instance instanceof HookService) {
        instance.state = "after";
        expect(context.target).toBeDefined();
      }
    });

    @HyperApp({
      modules: [],
      imports: [HookService],
      hooks: {
        onBeforeInit: onBefore,
        onAfterInit: onAfter
      }
    })
    class HookApp { }

    await createApplication(HookApp);
    const service = container.resolve(HookService);

    expect(onBefore).toHaveBeenCalled();
    expect(onAfter).toHaveBeenCalled();
    expect(service.state).toBe("after");

    console.log("✅ OBJECT-BASED HOOKS VERIFIED");
  });
});

@HyperService()
class DependencyService {
  public value = "dep-ok";
}

@HyperService()
class ClassHookService implements OnInit {
  public state: string = "initial";
  async onInit() {
    if (this.state === "initial") {
      this.state = "initialized";
    }
  }
}

@HyperService()
class ClassHook implements IHyperHooks {
  constructor(private dep: DependencyService) { }

  onBeforeInit(instance: any) {
    if (instance instanceof ClassHookService) {
      instance.state = `class-before-${this.dep.value}`;
    }
  }
}

describe("Class-based Hooks with DI", () => {
  it("should resolve hooks from container and allow dependencies", async () => {
    console.log("Starting Class-based Hooks test...");
    @HyperApp({
      modules: [],
      imports: [ClassHookService, DependencyService],
      hooks: ClassHook
    })
    class classHookApp { }

    console.log("Creating application...");
    await createApplication(classHookApp);
    console.log("App created.");

    const service = container.resolve(ClassHookService);
    require('fs').writeFileSync('debug.txt', 'State: ' + service.state);

    expect(service.state).toBe("class-before-dep-ok");
    console.log("✅ CLASS-BASED HOOKS VERIFIED");
  });
});
