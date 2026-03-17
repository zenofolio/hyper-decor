import "reflect-metadata";
import { container, injectable } from "tsyringe";
import { HyperMeta } from "./metadata";
import { Constructor } from "./types";

interface ServiceDecoratorOptions {
  singleton?: boolean;
  token?: string | symbol;
}

/**
 * 🚀 HyperService Decorator
 * Purely injects metadata and registers the class in the DI container.
 */
export function HyperService({
  token,
  singleton = true,
}: ServiceDecoratorOptions = {}) {
  return (Target: any) => {
    const useToken = token ?? Target;

    // 1. DI Registration
    injectable()(Target);

    if (!container.isRegistered(useToken)) {
      if (singleton) {
        container.registerSingleton(useToken, Target);
      } else {
        container.register(useToken, { useClass: Target });
      }
    }

    // 2. Hierarchical Metadata Injection
    HyperMeta.set(Target, undefined, {
      type: 'service',
    });

    return Target;
  };
}


