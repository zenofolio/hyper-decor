import { Request, Response } from "hyper-express";
import who from "../__internals/helpers/who.helper";
import NotPropertyException from "../exeptions/NotPropertyException";
import { KEY_PARAMS_PASS } from "../__internals/constants";

interface PassOptions {
  (req: Request, res: Response): boolean | Promise<boolean>;
}

/**
 * This method will pass all checks if the function returns true.
 *
 * @param options
 * @returns
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
