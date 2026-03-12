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
import { collectClassMetadata } from "../../lib/openapi/collectors/class.collector";
import { openApiRegistry } from "../../lib/openapi/metadata.registry";

export interface AppTree {
  app: HyperAppMetadata & { target: any; fullPath: string };
  modules: Record<string, ModuleNode>; // Keyed by Module Name
  paths: Record<string, RouteNode[]>; // Flattened map of paths
  openapi?: any; // Global OpenAPI info
}

export interface ModuleNode {
  metadata: HyperModuleMetadata;
  target: any;
  fullPath: string;
  modules: Record<string, ModuleNode>;
  controllers: Record<string, ControllerNode>;
  services: any[];
  openapi?: any;
}

export interface ControllerNode {
  metadata: HyperControllerMetadata;
  target: any;
  fullPath: string;
  routes: RouteNode[];
  services: any[];
  openapi?: any;
}

export interface RouteNode extends RouteMetadata {
  fullPath: string;
  params: any[];
  openapi?: any;
}

/**
 * Extracts the complete application metadata tree.
 */
export function getAppTree(Target: any): AppTree {
  const appMetadata = getDecorData<HyperAppMetadata>(KEY_PARAMS_APP, Target);
  const prefix = appMetadata?.prefix || "/";
  
  const tree: AppTree = {
    app: { ...appMetadata, target: Target, fullPath: prefix } as any,
    modules: {},
    paths: {}
  };

  (appMetadata?.modules || []).forEach(m => {
    const node = getModuleNode(m, prefix, tree.paths);
    tree.modules[m.name] = node;
  });

  // Apply tree processors
  openApiRegistry.getProcessors().forEach(processor => processor(tree));

  return tree;
}

function getModuleNode(Target: any, parentPath: string = "", globalPaths: Record<string, RouteNode[]> = {}): ModuleNode {
  const metadata = getDecorData<HyperModuleMetadata>(KEY_PARAMS_MODULE, Target);
  const currentPath = join(parentPath, metadata?.path || "");
  
  const openapi = collectClassMetadata(Target);

  const node: ModuleNode = {
    metadata,
    target: Target,
    fullPath: currentPath,
    modules: {},
    controllers: {},
    services: (metadata?.imports || []),
    openapi
  };

  (metadata?.modules || []).forEach(m => {
    node.modules[m.name] = getModuleNode(m, currentPath, globalPaths);
  });

  (metadata?.controllers || []).forEach(c => {
    node.controllers[c.name] = getControllerNode(c, currentPath, globalPaths);
  });

  return node;
}

function getControllerNode(Target: any, parentPath: string = "", globalPaths: Record<string, RouteNode[]> = {}): ControllerNode {
  const metadata = getDecorData<HyperControllerMetadata>(KEY_TYPE_CONTROLLER, Target);
  const routeList = getDecorData<RouterList>(KEY_PARAMS_ROUTE, Target);
  
  // Param metadata can be on the constructor or the prototype
  const paramMetadata = getDecorData<HyperParameterMetadata>(KEY_PARAMS_PARAM, Target) 
    ?? getDecorData<HyperParameterMetadata>(KEY_PARAMS_PARAM, Target.prototype);
  
  const currentPath = join(parentPath, metadata?.path || "");
  const openapi = collectClassMetadata(Target);

  const routes: RouteNode[] = Array.from(routeList?.routes || []).map((route: any) => {
    // Also try to get params from the handler itself if not in aggregated metadata
    const params = paramMetadata?.params?.[route.propertyKey] 
      ?? getDecorData<HyperParameterMetadata>(KEY_PARAMS_PARAM, route.handler)?.params?.[route.propertyKey]
      ?? [];

    const fullPath = join(currentPath, route.path);
    
    // Get OpenAPI metadata for the method
    const methodOpenApi = openapi.methods?.[route.propertyKey] || {};

    const routeNode: RouteNode = {
      ...route,
      fullPath,
      params,
      openapi: methodOpenApi
    };

    // Add to global paths map
    if (!globalPaths[fullPath]) {
      globalPaths[fullPath] = [];
    }
    globalPaths[fullPath].push(routeNode);

    return routeNode;
  });

  return {
    metadata,
    target: Target,
    fullPath: currentPath,
    routes,
    services: metadata?.imports || [],
    openapi
  };
}
