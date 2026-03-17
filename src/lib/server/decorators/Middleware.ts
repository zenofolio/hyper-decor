import "reflect-metadata";
import { MiddlewareHandler } from "hyper-express";
import { HyperMeta } from "./metadata";
import { MiddlewareType } from "./types";

/**
 * 🚀 Middleware Decorator
 * Purely injects middleware metadata into the target class or method.
 */
export const Middleware = (...middleware: MiddlewareType[]): any =>
  (target: any, propertyKey?: string | symbol) => {
    const current = HyperMeta.get(target, propertyKey) as any;
    const existing = current.middlewares || [];
    HyperMeta.set(target, propertyKey, { 
      middlewares: [...existing, ...middleware] 
    });
  };

/**
 * Exclude middleware from matching paths.
 */
Middleware.exclude = (
  expressions: RegExp | RegExp[],
  middleware: MiddlewareHandler
): any =>
  (target: any, propertyKey?: string | symbol) => {
    const handler = buildHandler("exclude", expressions, middleware);
    const current = HyperMeta.get(target, propertyKey) as any;
    const existing = current.middlewares || [];
    HyperMeta.set(target, propertyKey, { 
      middlewares: [...existing, handler] 
    });
  };

/**
 * Only run middleware on matching paths.
 */
Middleware.only = (
  expressions: RegExp | RegExp[],
  middleware: MiddlewareHandler
): any =>
  (target: any, propertyKey?: string | symbol) => {
    const handler = buildHandler("only", expressions, middleware);
    const current = HyperMeta.get(target, propertyKey) as any;
    const existing = current.middlewares || [];
    HyperMeta.set(target, propertyKey, { 
      middlewares: [...existing, handler] 
    });
  };

/**
 * Helper function to build middleware handlers for "only" and "exclude" modes.
 */
const buildHandler = (
  mode: "only" | "exclude",
  expressions: RegExp | RegExp[],
  middleware: MiddlewareHandler
): MiddlewareHandler => {
  const matchers = Array.isArray(expressions) ? expressions : [expressions];

  return (req, res, next) => {
    const matches = matchers.some((rx) => rx.test(req.path));

    if ((mode === "only" && !matches) || (mode === "exclude" && matches)) {
      return next();
    }

    return middleware(req, res, next);
  };
};
