import createParamDecorator from "../__internals/creators/request.creator";
import { $get } from "../__internals/utils/object.util";
import { ParameterResolver } from "./types";

/**
 * Get the value of a key from the request object
 *
 * @param key
 * @returns
 */
/**
 * Get the value of a key from the request object or transform the entire query.
 * 
 * @example
 * \@Query('id')
 * \@Query('id', IntSchema)
 * \@Query(UserQueryDto)
 */
export function Query(keyOrSchema?: string | any, schemaOrTransform?: any): any {
  // Case: @Query(UserQueryDto)
  if (typeof keyOrSchema === 'function' && !schemaOrTransform) {
    return createParamDecorator("query", "Query", (request) => request.query, keyOrSchema, true);
  }

  // Case: @Query('id', IntSchema) or @Query('id', data => ...)
  const key = keyOrSchema as string;
  const resolver = (request: any) => $get(request.query, key, request.query);

  if (typeof schemaOrTransform === 'function' && schemaOrTransform.prototype === undefined) {
    // It's a legacy transform function: data => ...
    return createParamDecorator("query", "Query", (request) => {
      const value = resolver(request);
      return schemaOrTransform(value);
    });
  }

  // It's either a schema/DTO class or just a key
  return createParamDecorator("query", "Query", resolver, schemaOrTransform, false);
}

/**
 * Get the body of the request or transform it via a schema.
 * 
 * @example
 * \@Body()
 * \@Body(CreateUserDto)
 */
export function Body(schemaOrResolver?: any): any {
  const resolver = async (request: any) => {
    return (request as any).body !== undefined ? (request as any).body : await request.json();
  };

  if (typeof schemaOrResolver === 'function' && schemaOrResolver.prototype !== undefined) {
    // Case: @Body(CreateUserDto)
    return createParamDecorator("req", "BODY", resolver, schemaOrResolver, true);
  }

  // Case: @Body(data => ...) (Legacy) or @Body()
  return createParamDecorator("req", "BODY", async (request) => {
    const value = await resolver(request);
    return typeof schemaOrResolver === 'function' ? schemaOrResolver(value) : value;
  });
}

/**
 * Get the params from the request or transform via schema.
 * 
 * @example
 * \@Param('id')
 * \@Param('id', IntSchema)
 */
export function Param(keyOrSchema: string | any, schemaOrValidator?: any): any {
  // Case: @Param(ParamsDto)
  if (typeof keyOrSchema === 'function' && !schemaOrValidator) {
    return createParamDecorator("params", "Param", (req) => req.params, keyOrSchema, true);
  }

  const key = keyOrSchema as string;
  const resolver = (req: any) => $get(req.params, key, req.params as any);

  if (typeof schemaOrValidator === 'function' && schemaOrValidator.prototype === undefined) {
    // Legacy validator function
    return createParamDecorator("params", "Param", (req) => {
      const value = resolver(req);
      return schemaOrValidator(value);
    });
  }

  return createParamDecorator("params", "Param", resolver, schemaOrValidator, false);
}

/**
 * Get the headers from the request.
 */
export function Headers(keyOrSchema?: string | any, schema?: any): any {
  if (typeof keyOrSchema === 'function' && !schema) {
    return createParamDecorator("headers", "Headers", (req) => req.headers, keyOrSchema, true);
  }

  const key = keyOrSchema as string;
  const resolver = (req: any) => $get(req.headers, key, req.headers as any);

  return createParamDecorator("headers", "Headers", resolver, schema, false);
}

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
