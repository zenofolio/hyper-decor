import { KEY_PARAMS_MODULE } from "../__internals/constants";
import { HyperModuleDecorator } from "./types";
import { DecoratorHelper } from "../__internals/decorator-base";

/**
 * Decorator to define a module with controllers and services.
 */

export const HyperModule: HyperModuleDecorator = (options) =>
  DecoratorHelper({
    type: KEY_PARAMS_MODULE,
    key: KEY_PARAMS_MODULE,
    options,
  });
