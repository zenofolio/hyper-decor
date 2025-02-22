import { HyperRoleOptions, HyperScopeOptions } from "./src/type";

declare module "hyper-express" {
  interface Request {
    setRoleScopes(role: HyperRoleOptions, scopes: HyperScopeOptions): void;

    getScopes(): string[] | undefined;
    setScopes(scopes: HyperScopeOptions): void;
    setFullScopes(): void

    getRoles(): string[] | undefined;
    setRole(role: HyperRoleOptions): void;

    hasRole(role: HyperRoleOptions): boolean;
    hasScopes(scopes: HyperScopeOptions): boolean;
  }
}
