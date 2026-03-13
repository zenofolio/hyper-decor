import "reflect-metadata";
import { Request } from "hyper-express";
import {
  DESIGN_PARAMTYPES,
  KEY_PARAMS_PARAM,
  KEY_TYPE_CONTROLLER,
} from "../constants";
import { DecoratorHelper } from "../decorator-base";
import {
  HyperParameterMetadata,
  ParameterResolver,
} from "../../decorators/types";
import WrongPlaceException from "../../exeptions/WrongPlaceException";
import { extractArgsNames } from "../utils/function.util";
import { $get } from "../utils/object.util";
import { transformRegistry } from "../transform/transform.registry";

type AnyFn = (...args: any[]) => any;
type Extractor = (req: Request, res: any) => any | Promise<any>;
type Selector = (value: any) => any;
type Transformer = (value: any, req: Request, res: any) => any | Promise<any>;

const identitySelector: Selector = (value) => value;
const identityTransformer: Transformer = (value) => value;


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
      const isProperty = typeof parameterIndex === "number";

      if (!isProperty) {
        throw new WrongPlaceException(
          decoratorName,
          "parameter",
          `${Target.constructor.name}.${String(propertyKey)}`,
          Target
        );
      }

      const saved = options ?? { params: {} };
      const method = Target[propertyKey];

      const names = extractArgsNames(method);
      const types = Reflect.getMetadata(DESIGN_PARAMTYPES, Target, propertyKey);

      const name = names?.[parameterIndex];
      const type = types?.[parameterIndex];

      let key: string | undefined = undefined;
      let inputSchemaOrFn: any = undefined;
      let wholeSource = isWholeSource;

      if (typeof keyOrSchema === "string") {
        key = keyOrSchema;
        inputSchemaOrFn = schemaOrTransform;
      } else if (keyOrSchema !== undefined) {
        inputSchemaOrFn = keyOrSchema;
        wholeSource = true;
      }

      const hasKey = key !== undefined && key !== "";
      const hasTransform = inputSchemaOrFn !== undefined;

      const extractor = createExtractor(_sourceKey);
      const selector = createSelector(key);
      const transformer = createTransformer(
        inputSchemaOrFn,
        _sourceKey,
        wholeSource
      );

      const resolver = composeResolver(
        extractor,
        selector,
        transformer,
        hasKey,
        hasTransform
      );

      if (name && saved) {
        let methodParams = saved.params[propertyKey];

        if (!methodParams) {
          methodParams = saved.params[propertyKey] = [];
        }

        methodParams.push({
          name,
          type,
          index: parameterIndex,
          key: _sourceKey,
          method: propertyKey.toString(),
          resolver,
          schema: inputSchemaOrFn,
          isWholeSource: wholeSource,
        });

        if (methodParams.length > 1) {
          methodParams.sort((a, b) => a.index - b.index);
        }

        Reflect.defineMetadata(KEY_PARAMS_PARAM, saved, method);
      }

      return saved;
    },
  }) as any;
}



//////////////////////////
/// Functions
/////////////////////////

function createBodyExtractor(): Extractor {
  return async (req: Request) => {
    const request = req as any;
    const cachedBody = request.body;

    if (cachedBody !== undefined) {
      return cachedBody;
    }

    const body = await req.json();
    request.body = body;
    return body;
  };
}

function createReqExtractor(): Extractor {
  return async (req) => req;
}

function createResExtractor(): Extractor {
  return async (_req, res) => res;
}

function createGenericExtractor(sourceKey: string): Extractor {
  return async (req) => (req as any)[sourceKey];
}

function createExtractor(sourceKey: string): Extractor {
  switch (sourceKey) {
    case "body":
      return createBodyExtractor();
    case "req":
      return createReqExtractor();
    case "res":
      return createResExtractor();
    default:
      return createGenericExtractor(sourceKey);
  }
}

function createSelector(key?: string): Selector {
  if (key === undefined || key === "") {
    return identitySelector;
  }

  return (value: any) => $get(value, key as any, value);
}

function createDirectTransformer(fn: AnyFn): Transformer {
  return (value) => fn(value);
}

function createRegistryTransformer(
  schema: any,
  sourceKey: string,
  isWholeSource: boolean
): Transformer {
  const options = { isWholeSource };
  const from = sourceKey as any;

  return (value, req, res) =>
    transformRegistry.resolve({
      data: value,
      schema,
      options,
      req,
      res,
      from,
    });
}

function createTransformer(
  inputSchemaOrFn: any,
  sourceKey: string,
  isWholeSource: boolean
): Transformer {
  if (inputSchemaOrFn === undefined) {
    return identityTransformer;
  }

  if (
    typeof inputSchemaOrFn === "function" &&
    inputSchemaOrFn.prototype === undefined
  ) {
    return createDirectTransformer(inputSchemaOrFn);
  }

  if (
    typeof inputSchemaOrFn === "function" ||
    typeof inputSchemaOrFn === "string"
  ) {
    return createRegistryTransformer(inputSchemaOrFn, sourceKey, isWholeSource);
  }

  return identityTransformer;
}

function composeResolver(
  extractor: Extractor,
  selector: Selector,
  transformer: Transformer,
  hasKey: boolean,
  hasTransform: boolean
): ParameterResolver {
  if (!hasKey && !hasTransform) {
    return extractor as ParameterResolver;
  }

  if (hasKey && !hasTransform) {
    return async (req, res) => {
      const value = await extractor(req, res);
      return selector(value);
    };
  }

  if (!hasKey && hasTransform) {
    return async (req, res) => {
      const value = await extractor(req, res);
      return transformer(value, req, res);
    };
  }

  return async (req, res) => {
    const value = await extractor(req, res);
    return transformer(selector(value), req, res);
  };
}
