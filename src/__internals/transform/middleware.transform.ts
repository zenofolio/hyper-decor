import { MiddlewareHandler } from "hyper-express";
import { container } from "tsyringe";
import { MiddlewareClass, MiddlewareType } from "../../lib/server/decorators";

export default function middlewareTransformer(
  list: MiddlewareType[]
): MiddlewareHandler[] {
  return list
    .map((middleware, idx) => {
      console.log(`[DEBUG] middlewareTransformer [${idx}]: processing ${typeof middleware}`);
      if (isClass(middleware)) {
        console.log(`[DEBUG] middlewareTransformer [${idx}]: resolving class ${middleware.name}`);
        const instance = container.resolve(
          middleware as any
        ) as MiddlewareClass;
        return instance.handle.bind(instance);
      }

      if (typeof middleware === "function") {
        console.log(`[DEBUG] middlewareTransformer [${idx}]: using function ${middleware.name || 'anonymous'}`);
        return middleware;
      }

      console.log(`[DEBUG] middlewareTransformer [${idx}]: unknown type, skipping`);
      return null;
    })
    .filter((middleware) => !!middleware) as MiddlewareHandler[];
}

const isClass = (fn: any) =>
  typeof fn === "function" && `${fn}`.indexOf("class") === 0;
