import { getDecorData } from "../decorator-base";
import {
  KEY_PARAMS_APP,
  KEY_PARAMS_MODULE,
  KEY_TYPE_CONTROLLER,
  KEY_PARAMS_ROUTE,
  KEY_PARAMS_PARAM,
} from "../constants";
import {
  HyperAppMetadata,
  HyperModuleMetadata,
  HyperControllerMetadata,
  HyperParameterMetadata,
  RouteMetadata,
} from "../../decorators/types";
import { RouterList } from "../types";

import { join } from "../utils/path.util";

export interface AppTree {
  app: HyperAppMetadata & { target: any; fullPath: string };
  modules: ModuleNode[];
}

export interface ModuleNode {
  metadata: HyperModuleMetadata;
  target: any;
  fullPath: string;
  modules: ModuleNode[];
  controllers: ControllerNode[];
  services: any[]; // The resolved services/imports
}

export interface ControllerNode {
  metadata: HyperControllerMetadata;
  target: any;
  fullPath: string;
  routes: RouteNode[];
  services: any[]; // The resolved services/imports
}

export interface RouteNode extends RouteMetadata {
  fullPath: string;
  params: any[];
}

/**
 * Extracts the complete application metadata tree.
 * This is useful for generating Swagger/OpenAPI documentation or graphing the app structure.
 */
export function getAppTree(Target: any): AppTree {
  const appMetadata = getDecorData<HyperAppMetadata>(KEY_PARAMS_APP, Target);
  const prefix = appMetadata?.prefix || "/";
  
  return {
    app: { ...appMetadata, target: Target, fullPath: prefix } as any,
    modules: (appMetadata?.modules || []).map(m => getModuleNode(m, prefix))
  };
}

function getModuleNode(Target: any, parentPath: string = ""): ModuleNode {
  const metadata = getDecorData<HyperModuleMetadata>(KEY_PARAMS_MODULE, Target);
  const currentPath = join(parentPath, metadata?.path || "");
  
  return {
    metadata,
    target: Target,
    fullPath: currentPath,
    modules: (metadata?.modules || []).map(m => getModuleNode(m, currentPath)),
    controllers: (metadata?.controllers || []).map(c => getControllerNode(c, currentPath)),
    services: (metadata?.imports || [])
  };
}

function getControllerNode(Target: any, parentPath: string = ""): ControllerNode {
  const metadata = getDecorData<HyperControllerMetadata>(KEY_TYPE_CONTROLLER, Target);
  const routeList = getDecorData<RouterList>(KEY_PARAMS_ROUTE, Target);
  const paramMetadata = getDecorData<HyperParameterMetadata>(KEY_PARAMS_PARAM, Target);
  
  const currentPath = join(parentPath, metadata?.path || "");

  const routes: RouteNode[] = Array.from(routeList?.routes || []).map((route: any) => {
    const params = paramMetadata?.params?.[route.propertyKey] || [];
    return {
      ...route,
      fullPath: join(currentPath, route.path),
      params
    };
  });

  return {
    metadata,
    target: Target,
    fullPath: currentPath,
    routes,
    services: metadata?.imports || []
  };
}
