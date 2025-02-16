import "reflect-metadata";
import { injectable } from "tsyringe";
import { $constructor } from "./utils/object.util";

export type DecoratorBaseTypes =
  | "APP"
  | "MODULE"
  | "CONTROLLER"
  | "ROUTE"
  | "MIDDLEWARE";

type DefineResolve<T> = (
  old: T,
  target?: any,
  property?: any,
  descriptor?: any
) => T;

interface onDefineResolve<T> {
  (
    data: {
      key: string;
      options: T;
      target: any;
      property?: any;
      descriptor?: any;
    },
    defineData: (options: T) => void
  ): void;
}

interface BeseDecoratorOptions<T extends any = any> {
  type?: DecoratorBaseTypes | string;
  key: string;
  options: T | DefineResolve<T>;
  targetResolver?: (
    target: any,
    propertyKey?: any,
    descriptorOrIndex?: any
  ) => any;
  onDefineData?: onDefineResolve<T>;
}

interface BeseDecorator<T> {
  (target: T): any;
  (target: T, propertyKey?: any, descriptor?: any): any;
}

type TransformFunction<TOptions, T> = (
  options: TOptions,
  target: T,
  propertyKey?: any,
  descriptor?: any
) => any;

export function DecoratorHelper<T, Target extends any = any>(
  { key, type, options, targetResolver, onDefineData }: BeseDecoratorOptions<T>,
  ...transformers: TransformFunction<T, Target>[]
): BeseDecorator<Target> {
  return (target: Target, propertyKey?: any, descriptor?: any) => {
    const isProperty = !!propertyKey;
    const isMethod = !!descriptor;

    let _options = options;
    const Target = targetResolver
      ? targetResolver(target, propertyKey, descriptor)
      : target;

    if (options instanceof Function) {
      const data = getDecorData<T>(key, Target);
      const optionsResolver = options as DefineResolve<T>;
      const value = optionsResolver(data, Target, propertyKey, descriptor);

      if (value)
        _options = {
          ..._options,
          ...value,
        };
    }

    if (onDefineData) {
      onDefineData(
        {
          key,
          options: { type, ..._options } as any,
          target: Target,
          property: propertyKey,
          descriptor,
        },
        (data) => {
          defineDecorData(key, { type, ...data }, Target);
        }
      );
    } else {
      defineDecorData(key, { type, ..._options }, Target);
    }

    let value = Target;
    if (transformers.length) {
      const transforms = transformers.map((fn) =>
        fn.bind(Target, _options as any)
      ) as any;

      if (isProperty) {
        defineDecorData(key, { type, ...options }, Target, propertyKey);
        value = Reflect.decorate(transforms, Target as any, propertyKey) as any;
      } else if (isMethod) {
        defineDecorData(key, { type, ...options }, Target);
        value = Reflect.decorate(
          transforms,
          Target as any,
          propertyKey,
          descriptor
        ) as any;
      } else {
        defineDecorData(key, { type, ...options }, Target);
        value = Reflect.decorate(transforms, Target as any) as any;
      }
    }

    injectable()($constructor(target));

    return value;
  };
}

export const defineDecorData = <T>(
  key: string,
  options: T | DefineResolve<T>,
  target: any,
  property?: any,
  descriptor?: any
) => {
  let value = options;

  if (typeof options === "function") {
    const old = getDecorData<T>(key, target, property);
    value = {
      ...old,
      ...(options as DefineResolve<T>)(old, target, property, descriptor),
    };
  }

  if (property) {
    Reflect.defineMetadata(key, value, target, property);
  } else {
    Reflect.defineMetadata(key, value, target);
  }
};

export const getDecorData = <T>(key: string, target: any, property?: any): T =>
  property
    ? Reflect.getMetadata(key, target, property)
    : Reflect.getMetadata(key, target);

export const hasDecorData = (key: string, target: any, property?: any) =>
  property
    ? Reflect.hasMetadata(key, target, property)
    : Reflect.hasMetadata(key, target);

export const extractDecorData = <T>(target: any): T | undefined => {
  const keys = Reflect.getMetadataKeys(target);

  return keys.reduce((acc, key) => {
    acc[key] = Reflect.getMetadata(key, target);
    return acc;
  }, {} as any);
};
