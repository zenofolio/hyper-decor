import { MiddlewareHandler } from "hyper-express";
import { container } from "tsyringe";
import { MiddlewareClass, MiddlewareType } from "../../decorators";

export default function middlewareTransformer(
  list: MiddlewareType[]
): MiddlewareHandler[] {
  return list
    .map((middleware) => {
      if (isClass(middleware)) {
        const instance = container.resolve(
          middleware as any
        ) as MiddlewareClass;
        return instance.handle.bind(instance);
      }

      if (typeof middleware === "function") {
        return middleware;
      }

      return null;
    })
    .filter((middleware) =>  !!middleware) as MiddlewareHandler[];
}

const isClass = (fn: any) =>
  typeof fn === "function" && `${fn}`.indexOf("class") === 0;
