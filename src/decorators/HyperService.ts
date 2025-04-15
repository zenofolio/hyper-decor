import { container } from "tsyringe";
import { serviceStore } from "../__internals/stores/service.store";
import { Constructor } from "./types";

interface ServiceDecoratorOptions {
  singleton?: boolean;
}

/**
 * HyperService decorator is used to register a class as a service in the tsyringe container.
 *
 * No matter where this decorator is applied, the class will be registered in the tsyringe container
 * and included in the service store to be launched when the application starts.
 *
 * @param options.singleton - Whether to register as a singleton (default: true)
 */
export const HyperService = ({
  singleton = true,
}: ServiceDecoratorOptions = {}) => {
  return (target: Constructor) => {
    if (!container.isRegistered(target)) {
      if (singleton) {
        container.registerSingleton(target);
      } else {
        container.register(target, { useClass: target });
      }
    }

    serviceStore.add(target);
  };
};
