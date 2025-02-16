import "reflect-metadata";
import { Request } from "hyper-express";
import { paramsStore, ByPassKeys } from "../stores/params.store";
import { extreactArgsNames } from "../utils/function.util";
import {
  DESIGN_PARAMTYPES,
  KEY_PARAMS_PARAM,
  KEY_TYPE_CONTROLLER,
} from "../constants";
import { DecoratorHelper, getDecorData } from "../decorator-base";
import { HyperParamerMetadata, ParameterResolver } from "../../decorators";
import who from "../helpers/who.helper";
import WrongPlaceException from "../../exeptions/WrongPlaceException";

/**
 * Creates a parameter decorator for handling request data.
 *
 * @param {keyof Request | ByPassKeys} key - The key to extract from the request.
 * @param {IParamsResolver} resolver - Resolver function to handle the parameter.
 * @returns {ParameterDecorator} - The parameter decorator function.
 */
export default function createParamDecorator(
  key: keyof Request | ByPassKeys,
  decoratorName: string,
  resolver: ParameterResolver
): ParameterDecorator {
  const _key = key as string;
  return DecoratorHelper<HyperParamerMetadata>({
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

      const names = extreactArgsNames(Target[propertyKey]);
      const types = Reflect.getMetadata(DESIGN_PARAMTYPES, Target, propertyKey);
      const name = names?.[parameterIndex];
      const type = types?.[parameterIndex];

      if (name && saved) {
        if (!saved.params[propertyKey]) {
          saved.params[propertyKey] = [];
        }

        saved.params[propertyKey].push({
          name,
          type,
          index: parameterIndex,
          key: _key,
          method: propertyKey.toString(),
          resolver,
        });

        // sort by index
        saved.params[propertyKey].sort((a, b) => a.index - b.index);

        Reflect.defineMetadata(KEY_PARAMS_PARAM, saved, Target[propertyKey]);
      }

      return saved;
    },
  }) as any;
}
