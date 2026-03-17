import { transformRegistry } from "../../../__internals/transform/transform.registry";
import { HyperParameterMetadata, ParameterResolver } from "./types";
import { HyperMeta } from "./metadata";

/**
 * 🛠️ Helper to create parameter decorators
 */
export function createParamDecorator(
  key: string,
  decorator: string,
  keyOrSchema?: string | object | Function,
  schemaOrTransform?: object | Function,
  isWholeSource: boolean = false,
  customResolver?: ParameterResolver
) {
  return (target: object, propertyKey: string | symbol, index: number) => {
    const root = HyperMeta.get(target, propertyKey) as any;
    const params = root.params?.params || [];

    const resolver: ParameterResolver = customResolver || (async (req: any, res: any) => {
      if (decorator === 'Req') return req;
      if (decorator === 'Res') return res;

      const source = (req as Record<string, any>)[key];
      if (!source) return null;

      const rawValue = isWholeSource ? source : (typeof keyOrSchema === 'string' ? source[keyOrSchema] : source);
      const schema = (typeof keyOrSchema === 'object' || typeof keyOrSchema === 'function') ? keyOrSchema : schemaOrTransform;

      if (!schema || typeof schema === 'string') return rawValue;

      return await transformRegistry.resolve({
        data: rawValue,
        schema,
        options: {},
        req,
        res,
        from: key
      });
    });

    params.push({
      index,
      type: (Reflect.getMetadata("design:paramtypes", target, propertyKey) || [])[index],
      key: typeof keyOrSchema === 'string' ? keyOrSchema : key,
      name: decorator,
      decorator,
      resolver,
      schema: typeof keyOrSchema === 'object' ? keyOrSchema : schemaOrTransform,
      isWholeSource: isWholeSource || typeof keyOrSchema !== 'string',
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
  return createParamDecorator("body", "Body", keyOrSchema, schemaOrTransform, true);
}

export function Param(keyOrSchema: string | object | Function, schemaOrTransform?: object | Function) {
  return createParamDecorator("params", "Param", keyOrSchema, schemaOrTransform);
}

export function Headers(keyOrSchema?: string | object | Function, schemaOrTransform?: object | Function) {
  return createParamDecorator("headers", "Headers", keyOrSchema, schemaOrTransform);
}

export const Req = () => createParamDecorator("req", "Req", undefined, undefined, true, (req) => req);
export const Res = () => createParamDecorator("res", "Res", undefined, undefined, true, (req, res) => res);

export const createCustomRequestDecorator = (
  decoratorName: string,
  resolver: ParameterResolver
) => {
  return createParamDecorator("req", decoratorName, resolver);
};
