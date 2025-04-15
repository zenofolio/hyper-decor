import { Request, Response } from "hyper-express";
import who from "../__internals/helpers/who.helper";
import NotPropertyException from "../exeptions/NotPropertyException";
import { KEY_PARAMS_PASS } from "../__internals/constants";

interface PassOptions {
  (req: Request, res: Response): boolean | Promise<boolean>;
}

/**
 * Pass decorator
 *
 * This decorator allows bypassing checks when the provided function returns `true`.
 * It can be applied to classes or methods, but not to properties.
 *
 * @param options - A function that returns true to allow bypassing
 * @returns A class or method decorator
 */

export const Pass =
  (options: PassOptions): ClassDecorator & MethodDecorator =>
  (target: any, propertyKey?: any, descriptorOrIndex?: any) => {
    const { isProperty, isMethod } = who(
      target,
      propertyKey,
      descriptorOrIndex
    );

    if (isProperty) {
      throw new NotPropertyException(
        `${target.constructor.name}.${propertyKey?.toString()}`,
        target
      );
    }

    if (isMethod) {
      Reflect.defineMetadata(KEY_PARAMS_PASS, options, target, propertyKey);
    } else {
      Reflect.defineMetadata(KEY_PARAMS_PASS, options, target);
    }

    return target;
  };
