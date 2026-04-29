import "reflect-metadata";
import { container, InjectionToken } from "tsyringe";
import { HyperMeta } from "../__internals/stores";
import { initializeInstance } from "../__internals/helpers/lifecycle.helper";
import {
  Constructor,
  HyperAppMetadata,
  ImportType,
} from "../lib/server/decorators/types";
import { createApplication } from "./bootstrap";
import { HyperApp } from "../lib/server/decorators/HyperApp";
import { HyperCommonMetadata } from "../__internals/types";

export type Token<T = any> = InjectionToken<T> | Constructor<T> | string | (abstract new (...args: any[]) => T);

/**
 * 🧪 TestingModule
 * Holds the context of a compiled test environment.
 */
export class TestingModule {
  constructor(private target?: Constructor) { }

  /**
   * Resolves a dependency from the container and ensures it's initialized.
   */
  async resolve<T>(token: Token<T>): Promise<T> {
    return await deepResolve(token);
  }

  /**
   * Shortcut for resolve (consistent with NestJS)
   */
  async get<T>(token: Token<T>): Promise<T> {
    return await this.resolve(token);
  }

  /**
   * Creates the full HyperExpress application proxy.
   */
  async createHyperApplication(): Promise<any> {
    if (!this.target) {
      throw new Error("Cannot create application without a target module/app.");
    }
    return await createApplication(this.target);
  }
}

/**
 * 🛠️ TestingModuleBuilder
 * Fluent API for configuring the testing module.
 */
export class TestingModuleBuilder {
  private metadata: Partial<HyperAppMetadata>;

  constructor(metadata: Partial<HyperAppMetadata>) {
    this.metadata = metadata;
  }

  overrideProvider(token: Token): any {
    return {
      useValue: (value: any) => {
        container.register(token as InjectionToken, { useValue: value });
        return this;
      },
      useClass: (target: Constructor) => {
        container.register(token as InjectionToken, { useClass: target });
        return this;
      },
      useFactory: (factory: (...args: any[]) => any) => {
        container.register(token as InjectionToken, { useFactory: factory });
        return this;
      }
    };
  }

  async compile(): Promise<TestingModule> {
    // 1. Create a synthetic app if needed
    @HyperApp(this.metadata as HyperAppMetadata)
    class SyntheticApp { }

    // 2. Deep initialize all defined imports/providers
    if (this.metadata.imports) {
      for (const item of this.metadata.imports) {
        const token = typeof item === "object" && "token" in item ? item.token : (item as InjectionToken);
        await deepResolve(token);
      }
    }

    return new TestingModule(SyntheticApp);
  }
}

/**
 * 🚀 HyperTest
 * Entry point for creating testing environments.
 */
export class HyperTest {
  /**
   * Ultra-simple one-liner to boot a module or app.
   * const module = await HyperTest.create(AppModule);
   */
  static async create(Target: Constructor, options?: { providers?: ImportType[] }): Promise<TestingModule> {
    const builder = this.createTestingModule({
      imports: [Target, ...(options?.providers || [])]
    });

    const module = await builder.compile();

    // Ensure the target itself is deep-resolved
    await deepResolve(Target);

    return module;
  }

  /**
   * Full builder API for complex configurations.
   */
  static createTestingModule(metadata: Partial<HyperAppMetadata>): TestingModuleBuilder {
    return new TestingModuleBuilder(metadata);
  }

  /**
   * Resets the global container instances (but keeps registrations).
   * Useful between tests when isolation is not possible.
   */
  static reset() {
    container.clearInstances();
  }
}

/**
 * 🔄 deepResolve
 * Recursively resolves a token and ensures its onInit chain is executed.
 */
async function deepResolve<T>(token: Token<T>): Promise<T> {
  const instance = container.resolve(token as any) as any;

  // 1. Get the actual implementation constructor to inspect dependencies.
  // We prefer instance.constructor because if token is an abstract class,
  // dependencies are defined on the implementation.
  const target = instance?.constructor || (typeof token === "function" ? token : null);

  // 2. Recursive resolution of dependencies (Bottom-up initialization)
  if (target && typeof target === "function") {
    const paramTypes = Reflect.getMetadata("design:paramtypes", target) || [];
    const injectionTokens = Reflect.getOwnMetadata("injectionTokens", target) || {};

    for (let i = 0; i < paramTypes.length; i++) {
      // Use @inject token if present, otherwise use design:parafmtype
      const dep = injectionTokens[i] || paramTypes[i];

      // Avoid cycles or primitives
      if (dep && typeof dep === "function" && dep !== Object && dep !== Array && dep !== String && dep !== Number && dep !== Boolean) {
        await deepResolve(dep);
      }
    }
  }

  // 3. Metadata Discovery (traversing @HyperApp, @HyperModule, etc.)
  const metadata = HyperMeta.get(target) as any;
  if (metadata) {
    // Resolve imports
    if (metadata.imports && Array.isArray(metadata.imports)) {
      for (const item of metadata.imports) {
        const depToken = typeof item === "object" && item !== null && "token" in item ? item.token : (item as any);
        if (depToken) await deepResolve(depToken);
      }
    }
    // Resolve modules recursively
    if (metadata.modules && Array.isArray(metadata.modules)) {
      for (const m of metadata.modules) {
        await deepResolve(m);
      }
    }
    // Resolve controllers
    if (metadata.controllers && Array.isArray(metadata.controllers)) {
      for (const c of metadata.controllers) {
        await deepResolve(c);
      }
    }
  }

  // 4. Initialize the instance itself
  await initializeInstance(instance);

  return instance;
}
