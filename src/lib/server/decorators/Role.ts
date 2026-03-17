import "reflect-metadata";
import { HyperMeta } from "./metadata";
import { RoleType } from "./types";

/**
 * 🚀 Role Decorator
 * Purely injects role metadata into the target class or method.
 */
export const Role = <T extends string = string>(roles: RoleType<T>) =>
  (target: any, propertyKey?: any) => {
    const _roles = Array.isArray(roles) ? roles : [roles];
    HyperMeta.set(target, propertyKey, { roles: _roles });
  };
