import "reflect-metadata";
import {
  FULL_ACCESS,
  KEY_PARAMS_SCOPE,
  METADATA_KEYS,
} from "../__internals/constants";
import { ScopeType } from "./types";
import who from "../__internals/helpers/who.helper";
import MetadatStore from "../__internals/stores/metadata.store";

/**
 * Scope decorator for defining access scopes.
 */

export const Scope =
  <T extends string = string>(
    scopes: ScopeType<T>
  ): ClassDecorator & MethodDecorator & ParameterDecorator =>
  (target: any, propertyKey?: any, descriptorOrIndex?: any) => {
    const { isProperty } = who(target, propertyKey, descriptorOrIndex);

    if (isProperty) {
      throw new Error(
        `Scope decorator cannot be used as parameter decorator in ${target.constructor.name}.${propertyKey}`
      );
    }

    const list = MetadatStore.list<ScopeType>(KEY_PARAMS_SCOPE, {
      target,
      propertyKey,
    });

    list.set(...(Array.isArray(scopes) ? scopes : [scopes]));
  };
