import "reflect-metadata";
import { HyperMeta } from "./metadata";
import { ScopeType } from "./types";

/**
 * 🚀 Scope Decorator
 * Purely injects scope metadata into the target class or method.
 */
export const Scope = <T extends string = string>(scopes: ScopeType<T>) =>
  (target: any, propertyKey?: any) => {
    const _scopes = Array.isArray(scopes) ? scopes : [scopes];
    HyperMeta.set(target, propertyKey, { scopes: _scopes });
  };
