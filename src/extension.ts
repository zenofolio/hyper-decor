import { Request } from "hyper-express";
import { HyperRoleOptions, HyperScopeOptions } from "./type";
import {
  getRoles,
  getScopes,
  hasRole,
  hasScopes,
  setRole,
  setScopes,
  getValue,
  setValue
} from "./common/helpers";

/////////////////////////////
/// Mapa de métodos
/////////////////////////////
const requestMethods: Record<string, (this: Request, ...args: any[]) => any> = {
  setRole(this: Request, role: HyperRoleOptions) {
    setRole(this, role);
  },
  hasRole(this: Request, role: HyperRoleOptions) {
    return hasRole(this, role);
  },
  getRoles(this: Request) {
    return getRoles(this);
  },
  setScopes(this: Request, scopes: HyperScopeOptions) {
    setScopes(this, scopes);
  },
  setFullScopes(this: Request) {
    setScopes(this, ["*"]);
  },
  hasScopes(this: Request, scopes: HyperScopeOptions) {
    return hasScopes(this, scopes);
  },
  getScopes(this: Request) {
    return getScopes(this);
  },
  setRoleScopes(
    this: Request,
    role: HyperRoleOptions,
    scopes: HyperScopeOptions
  ) {
    setRole(this, role);
    setScopes(this, scopes);
  },
  setValue(this: Request, key: string, value: any) {
    setValue(this, key, value);
  },
  getValue<T>(this: Request, key: string, defaultValue?: T): T | undefined {
    return getValue<T>(this, key, defaultValue);
  },
};

/////////////////////////////
/// Agregar métodos al prototipo
/////////////////////////////
Object.entries(requestMethods).forEach(([key, method]) => {
  Object.defineProperty(Request.prototype, key, {
    value: method,
    writable: true,
    configurable: true,
  });
});
