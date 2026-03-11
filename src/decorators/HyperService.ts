import { container, injectable } from "tsyringe";
import { serviceStore } from "../__internals/stores/service.store";
import { Constructor } from "./types";

interface ServiceDecoratorOptions {
  singleton?: boolean;
  token?: string | symbol;
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
  token,
  singleton = true,
}: ServiceDecoratorOptions = {}) => {
  return (target: Constructor) => {
    const useToken = token ?? target;
    injectable()(target);

    if (!container.isRegistered(useToken)) {
      if (singleton) {
        container.registerSingleton(useToken, target);
      } else {
        container.register(useToken, { useClass: target });
      }
    }


    serviceStore.add(target);
  };
};


