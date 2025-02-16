import "reflect-metadata";
import { KEY_PARAMS_ROLE } from "../__internals/constants";
import { HyperMethodDecorator, RoleType } from "./types";
import who from "../__internals/helpers/who.helper";
import MetadatStore from "../__internals/stores";
import { HyperException } from "../exeptions";

/**
 * Role decorator for setting role-based access control.
 */

export const Role =
  <T extends string = string>(roles: RoleType<T>) =>
  (target: any, propertyKey?: any, descriptorOrIndex?: any) => {
    const _roles = Array.isArray(roles) ? roles : [roles];

    if (!_roles.length) {
      HyperException.throw(
        `Role decorator must have at least one role.`,
        "HyperException",
        {
          target,
          propertyKey,
          descriptorOrIndex,
        }
      );
    }

    const { isProperty, isMethod } = who(
      target,
      propertyKey,
      descriptorOrIndex
    );

    if (isProperty) {
      throw new Error(
        `Scope decorator cannot be used as parameter decorator in ${target.constructor.name}.${propertyKey}`
      );
    }

    const list = MetadatStore.list<RoleType>(KEY_PARAMS_ROLE, {
      target,
      propertyKey,
    });

    list.set(..._roles);
  };
