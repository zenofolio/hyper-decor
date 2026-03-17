import "reflect-metadata";
import { HyperMeta } from "./metadata";
import { RouteMetadata } from "./types";

/**
 * 🛠️ Helper to create route decorators
 */
function createRouteDecorator<T = Record<string, unknown>>(method: string) {
  return (path: string = "/", options?: T) => {
    return (target: object, propertyKey?: string | symbol) => {
      const returnType = Reflect.getMetadata("design:returntype", target, propertyKey!);

      HyperMeta.set(target, propertyKey!, {
        route: {
          method,
          path,
          propertyKey: propertyKey as string,
          options: options as Record<string, unknown>,
        } as RouteMetadata,
        reflection: {
          output: returnType
        }
      });
    };
  };
}

export const Get = createRouteDecorator("get");
export const Post = createRouteDecorator("post");
export const Put = createRouteDecorator("put");
export const Delete = createRouteDecorator("delete");
export const Patch = createRouteDecorator("patch");
export const Options = createRouteDecorator("options");
export const Head = createRouteDecorator("head");
export const Trace = createRouteDecorator("trace");
export const Any = createRouteDecorator("any");
export const All = createRouteDecorator("all");
export const Connect = createRouteDecorator("connect");
export const WS = createRouteDecorator("ws");
export const Upgrade = createRouteDecorator("upgrade");
