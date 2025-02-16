import { MiddlewareHandler } from "hyper-express";
import { RoleType, ScopeType } from "../decorators";

interface HyperAppStoreItemBase {
  middlewares: Set<MiddlewareHandler>;
  roles: Set<RoleType>;
  scopes: Set<ScopeType>;
}

interface HyperAppStoreRoute extends HyperAppStoreItemBase {
  method: string;
  path: string;
  handler: string;
}

interface HyperAppStoreController  extends HyperAppStoreItemBase {
    routes: Map<string, HyperAppStoreRoute>;
    
}

interface HyperAppStoreModule {
  controllers: Map<string, string>;
}

export default class HyperAppStore {
  private roles: Set<string> = new Set();
  private scopes: Set<string> = new Set();
  private modules: Map<string, string> = new Map();
  private controllers: Map<string, string> = new Map();
  private routes: Map<string, string> = new Map();
  private middlewares: Map<string, string> = new Map();

  public addRole(role: string) {
    this.roles.add(role);
  }

  addModuleRole(module: string, role: string) {}
}
