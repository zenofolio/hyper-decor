import { DecoratorHelper } from "../__internals/decorator-base";
import { HyperControllerDecorator, HyperControllerMetadata } from "./types";

import {
  KEY_PARAMS_CONTROLLER,
  KEY_TYPE_CONTROLLER,
} from "../__internals/constants";

export const HyperController = (
  options?: HyperControllerMetadata | string
): ClassDecorator => {
  const isString = typeof options === "string";

  return DecoratorHelper({
    type: KEY_TYPE_CONTROLLER,
    key: KEY_PARAMS_CONTROLLER,
    options: {
      path: isString ? options : options?.path ?? "/",
      roles: isString ? [] : options?.roles ?? [],
      scopes: isString ? [] : options?.scopes ?? [],
    },
  });
};
