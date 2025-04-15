import "reflect-metadata";
import { MiddlewareHandler } from "hyper-express";
import { KEY_PARAMS_MIDDLEWARES } from "../__internals/constants";
import MetadatStore from "../__internals/stores/metadata.store";
import { MiddlewareType } from "./types";

/**
 * Middleware decorator to attach middleware to controllers, modules, and routes.
 */
export const Middleware =
  (...middleware: MiddlewareType[]): ClassDecorator & MethodDecorator =>
  (Target: any, propertyKey?: any) => {
    MetadatStore.define(KEY_PARAMS_MIDDLEWARES, middleware, {
      target: Target,
      propertyKey,
    });
  };

/**
 * Exclude middleware from matching paths.
 *
 * @param expressions
 * @param middleware
 * @returns
 */
Middleware.exclude =
  (
    expressions: RegExp | RegExp[],
    middleware: MiddlewareHandler
  ): ClassDecorator & MethodDecorator =>
  (Target: any, propertyKey?: any) => {
    MetadatStore.define(
      KEY_PARAMS_MIDDLEWARES,
      buildHandler("exclude", expressions, middleware),
      {
        target: Target,
        propertyKey,
      }
    );
  };

/**
 * Only run middleware on matching paths.
 *
 * @param expresiosn
 * @param middleware
 * @returns
 */
Middleware.only =
  (expressions: RegExp | RegExp[], middleware: MiddlewareHandler) =>
  (Target: any, propertyKey?: any) => {
    MetadatStore.define(
      KEY_PARAMS_MIDDLEWARES,
      buildHandler("only", expressions, middleware),
      {
        target: Target,
        propertyKey,
      }
    );
  };

/**
 *
 * Helper function to build middleware handlers for "only" and "exclude" modes.
 *
 * @param mode
 * @param expresions
 * @returns
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
