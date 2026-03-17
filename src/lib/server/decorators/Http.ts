import { Request, Response } from "hyper-express";
import { transformRegistry } from "../../../__internals/transform/transform.registry";
import { HyperParameterMetadata, ParameterResolver } from "./types";
import { HyperMeta } from "./metadata";

/**
 * 🛠️ Helper to create parameter decorators
 */
export function createParamDecorator(
  source: "body" | "query" | "params" | "headers" | "req" | "res",
  decorator: string,
  keyOrSchema?: string | object | Function,
  schemaOrTransform?: object | Function,
  isWholeSource: boolean = false,
  customResolver?: ParameterResolver
) {
  return (target: object, propertyKey: string | symbol, index: number) => {
    const root = HyperMeta.get(target, propertyKey) as any;
    const params = root.params?.params || [];

    const picker = typeof keyOrSchema === 'string' ? keyOrSchema : undefined;
    const schema = (typeof keyOrSchema === 'object' || typeof keyOrSchema === 'function') 
      ? keyOrSchema 
      : schemaOrTransform;

    params.push({
      index,
      type: (Reflect.getMetadata("design:paramtypes", target, propertyKey) || [])[index],
      source,
      picker,
      schema,
      isWholeSource: isWholeSource || (picker === undefined && keyOrSchema !== undefined),
      decorator,
      resolver: customResolver,
    });

    HyperMeta.set(target, propertyKey, {
      params: { params } as HyperParameterMetadata
    });
  };
}

export function Query(keyOrSchema?: string | object | Function, schemaOrTransform?: object | Function) {
  return createParamDecorator("query", "Query", keyOrSchema, schemaOrTransform);
}

export function Body(keyOrSchema?: string | object | Function, schemaOrTransform?: object | Function) {
  return createParamDecorator("body", "Body", keyOrSchema, schemaOrTransform);
}

export function Param(keyOrSchema: string | object | Function, schemaOrTransform?: object | Function) {
  return createParamDecorator("params", "Param", keyOrSchema, schemaOrTransform);
}

export function Headers(keyOrSchema?: string | object | Function, schemaOrTransform?: object | Function) {
  return createParamDecorator("headers", "Headers", keyOrSchema, schemaOrTransform);
}

export const Req = () => createParamDecorator("req", "Req", undefined, undefined, true, (req) => req);
export const Res = () => createParamDecorator("res", "Res", undefined, undefined, true, (_req, res) => res);

export const createCustomRequestDecorator = (
  decoratorName: string,
  resolver: ParameterResolver
) => {
  return createParamDecorator("req", decoratorName, undefined, undefined, true, resolver);
};
