import "reflect-metadata";
import { Request, Response } from "hyper-express";
import { KEY_PARAMS_ROUTE, KEY_TYPE_CONTROLLER } from "../constants";
import { DecoratorHelper, getDecorData } from "../decorator-base";
import { RouterList } from "../types";

/**
 * Helper function to create route decorators for HTTP methods.
 *
 * @param {string} method - The HTTP method (e.g., GET, POST).
 * @returns {(path?: string) => MethodDecorator} - A method decorator for defining routes.
 *
 */
export default function createRouteDecorator<T extends any = undefined>(
  method: string
) {
  return (path: string = "/", options?: T): MethodDecorator & ClassDecorator =>
    DecoratorHelper<RouterList>({
      type: KEY_TYPE_CONTROLLER,
      key: KEY_PARAMS_ROUTE,
      targetResolver: (target) => target.constructor ?? target,
      options: (data, Target, propertyKey, descriptor) => {
        // add openAPI data here

        const handler = descriptor.value;
        if (typeof handler !== "function") return data;

        const saved: RouterList = Reflect.getMetadata(
          KEY_PARAMS_ROUTE,
          Target
        ) ?? {
          routes: new Set(),
        };

        saved.routes.add({
          className: Target.name,
          method,
          path,
          propertyKey,
          handler: handler,
          options,
        });

        return saved;
      },
    });
}
