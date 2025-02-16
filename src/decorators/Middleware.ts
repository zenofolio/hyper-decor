import "reflect-metadata";
import { MiddlewareHandler } from "hyper-express";
import { KEY_PARAMS_MIDDLEWARES } from "../__internals/constants";
import MetadatStore from "../__internals/stores";

/**
 * Middleware decorator to attach middleware to controllers, modules, and routes.
 */
export const Middleware =
  (...middleware: MiddlewareHandler[]): ClassDecorator & MethodDecorator =>
  (Target: any, propertyKey?: any, descriptor?: any) => {
    MetadatStore.define(KEY_PARAMS_MIDDLEWARES, middleware, {
      target: Target,
      propertyKey,
    });
  };

/**
 * Exclude middleware from matching paths.
 *
 * @param expresiosn
 * @param middleware
 * @returns
 */
Middleware.exclude = (
  expresiosn: RegExp | RegExp[],
  middleware: MiddlewareHandler
) => {
  return Middleware((req, res, next) => {
    expresiosn = Array.isArray(expresiosn) ? expresiosn : [expresiosn];
    const excluude = expresiosn.some((exp) => exp.test(req.path));

    if (excluude) return next();
    return middleware(req, res, next);
  });
};

/**
 * Only run middleware on matching paths.
 *
 * @param expresiosn
 * @param middleware
 * @returns
 */
Middleware.only = (
  expresiosn: RegExp | RegExp[],
  middleware: MiddlewareHandler
) => {
  return Middleware((req, res, next) => {
    expresiosn = Array.isArray(expresiosn) ? expresiosn : [expresiosn];
    const only = expresiosn.some((exp) => exp.test(req.path));

    if (!only) return next();
    return middleware(req, res, next);
  });
};
