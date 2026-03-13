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
  return createParamDecorator("query", "Query", keyOrSchema, schemaOrTransform);
}

export function Body(keyOrSchema?: string | any, schemaOrTransform?: any): any {
  return createParamDecorator("body", "Body", keyOrSchema, schemaOrTransform, true);
}

export function Param(keyOrSchema: string | any, schemaOrTransform?: any): any {
  return createParamDecorator("params", "Param", keyOrSchema, schemaOrTransform);
}

export function Headers(keyOrSchema?: string | any, schemaOrTransform?: any): any {
  return createParamDecorator("headers", "Headers", keyOrSchema, schemaOrTransform);
}

export const Req = () => createParamDecorator("req", "Req");
export const Res = () => createParamDecorator("res", "Res");

export const createCustomRequestDecorator = (
  decoratorName: string,
  resolver: ParameterResolver
) => {
  return createParamDecorator("req", decoratorName, resolver);
};
