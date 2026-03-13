import "reflect-metadata";
import { Request } from "hyper-express";
import {
  DESIGN_PARAMTYPES,
  KEY_PARAMS_PARAM,
  KEY_TYPE_CONTROLLER,
} from "../constants";
import { DecoratorHelper } from "../decorator-base";
import { HyperParameterMetadata, ParameterResolver } from "../../decorators/types";
import who from "../helpers/who.helper";
import WrongPlaceException from "../../exeptions/WrongPlaceException";
import { extractArgsNames } from "../utils/function.util";
import { $get } from "../utils/object.util";
import { transformRegistry } from "../transform/transform.registry";

export default function createParamDecorator(
  sourceKey: any,
  decoratorName: string,
  keyOrSchema?: string | any,
  schemaOrTransform?: any,
  isWholeSource: boolean = false
): ParameterDecorator {
  const _sourceKey = sourceKey as string;

  return DecoratorHelper<HyperParameterMetadata>({
    type: KEY_TYPE_CONTROLLER,
    key: KEY_PARAMS_PARAM,
    options: (options, Target, propertyKey, parameterIndex) => {
      const { isProperty } = who(Target, propertyKey, parameterIndex);

      if (!isProperty)
        throw new WrongPlaceException(
          decoratorName,
          "parameter",
          `${Target.constructor.name}.${propertyKey}`,
          Target
        );

      const saved = options ?? { params: {} };
      const names = extractArgsNames(Target[propertyKey]);
      const types = Reflect.getMetadata(DESIGN_PARAMTYPES, Target, propertyKey);
      const name = names?.[parameterIndex];
      const type = types?.[parameterIndex];

      // --- ULTRA OPTIMIZER: Resolver Composition ---
      let finalResolver: ParameterResolver;
      let finalSchema: any = undefined;
      let _isWholeSource = isWholeSource;

      // 1. Identify Key, Schema/Function
      let key: string | undefined = undefined;
      let inputSchemaOrFn: any = undefined;

      if (typeof keyOrSchema === "string") {
        key = keyOrSchema;
        inputSchemaOrFn = schemaOrTransform;
      } else if (keyOrSchema) {
        inputSchemaOrFn = keyOrSchema;
        _isWholeSource = true;
      }

      // Metadata for OpenAPI
      finalSchema = inputSchemaOrFn;

      // 2. Base Extractor (Hotpath optimized)
      const isBody = _sourceKey === "body";
      
      const extractor = isBody 
        ? async (req: Request) => {
            if ((req as any).body !== undefined) return (req as any).body;
            const body = await req.json();
            (req as any).body = body;
            return body;
          }
        : (req: Request, res: any) => {
            if (_sourceKey === "req") return req;
            if (_sourceKey === "res") return res;
            return (req as any)[_sourceKey];
          };

      // 3. Compose Final Resolver
      finalResolver = async (req, res) => {
          let val = isBody ? await extractor(req, res) : (extractor as any)(req, res);
          
          if (key) {
              val = $get(val, key as any, val);
          }

          if (typeof inputSchemaOrFn === "function") {
              if (inputSchemaOrFn.prototype === undefined) {
                  return inputSchemaOrFn(val);
              } else {
                  return await transformRegistry.resolve({
                      data: val,
                      schema: inputSchemaOrFn,
                      options: { isWholeSource: _isWholeSource },
                      req,
                      res,
                      from: _sourceKey as any,
                  });
              }
          }

          if (typeof inputSchemaOrFn === "string") {
              return await transformRegistry.resolve({
                  data: val,
                  schema: inputSchemaOrFn,
                  options: { isWholeSource: _isWholeSource },
                  req,
                  res,
                  from: _sourceKey as any,
              });
          }

          return val;
      };

      if (name && saved) {
        if (!saved.params[propertyKey]) {
          saved.params[propertyKey] = [];
        }

        saved.params[propertyKey].push({
          name,
          type,
          index: parameterIndex,
          key: _sourceKey,
          method: propertyKey.toString(),
          resolver: finalResolver,
          schema: finalSchema, // Kept for metadata/OpenAPI
          isWholeSource: _isWholeSource,
        });

        saved.params[propertyKey].sort((a, b) => a.index - b.index);
        Reflect.defineMetadata(KEY_PARAMS_PARAM, saved, Target[propertyKey]);
      }

      return saved;
    },
  }) as any;
}
