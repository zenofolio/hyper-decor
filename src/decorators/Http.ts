import createParamDecorator from "../__internals/creators/request.creator";
import { $get } from "../__internals/utils/object.util";
import { ParameterResolver } from "./types";

/**
 * Get the value of a key from the request object
 *
 * @param key
 * @returns
 */
export const Query = (key?: string, transfrom?: (data: any) => any) =>
  createParamDecorator("query", "Query", (request) => {
    const value = $get(request.query, key, request.query);
    if (!transfrom) return value;
    return value;
  });

/**
 * Get the body of the request
 *
 * @param resolver
 * @returns
 */
export const Body = <T, R>(resolver?: (data: T) => R) =>
  createParamDecorator("req", "BODY", async (request) => {
    const value = await request.json<T>();
    return resolver ? resolver(value) : value;
  });

/**
 * Get the params from the request
 *
 * @param k
 * @returns
 */
export const Param = (k?: string, validator?: (data: any) => any) =>
  createParamDecorator("params", "Param", (req) => {
    const value = $get(req.params, k as string, req.params as any);
    if (typeof validator === "function") return validator(value as any);
    return value;
  });

/**
 * get the headers from the request
 *
 * @param key
 * @returns
 */
export const Headers = <T extends string>(key?: T) =>
  createParamDecorator("headers", "Headers", (req) =>
    $get(req.headers, key, req.headers as any)
  );

export const Req = () => createParamDecorator("req", "Req", (req) => req);
export const Res = () => createParamDecorator("res", "Res", (req, res) => res);

/**
 * Create a custom request decorator
 * that can be used to extract data from the request object
 *
 *
 * @example
 * ```typescript
 *
 * interface LoginData {
 *  username: string;
 *  password: string;
 * }
 *
 * const LoginData = createCustomRequestDecorator<LoginData>({
 *  resolver: async (request) => {
 *    const data = await request.json();
 *    return [data];
 *  }
 * }
 *
 *
 *
 */

export const createCustomRequestDecorator = (
  decoratorName: string,
  resolver: ParameterResolver
) => {
  return createParamDecorator("req", decoratorName, resolver);
};
