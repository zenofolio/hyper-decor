import { Metadata } from "../../__internals/stores/meta.store";
import { SwaggerMeta } from "../openapi/metadata";

import {
  HyperAppMetadata,
  HyperModuleMetadata,
  HyperControllerMetadata,
  HyperParameterMetadata,
  RouteMetadata,
  ImportType,
  Constructor,
} from "../server/decorators/types";
import { HyperMetadataStore, HyperMethodMetadata, HyperPrefixRoot, HyperCommonMetadata } from "../../__internals/types";

import { join } from "../../__internals/utils/path.util";
import { openApiRegistry } from "../openapi/metadata.registry";

export interface AppTree {
  app: HyperAppMetadata & { target: object; fullPath: string };
  modules: Record<string, ModuleNode>; // Keyed by Module Name
  paths: Record<string, RouteNode[]>; // Flattened map of paths
  openapi?: Record<string, unknown>; // Global OpenAPI info
}

export interface ModuleNode {
  metadata: HyperModuleMetadata;
  target: object;
  fullPath: string;
  modules: Record<string, ModuleNode>;
  controllers: Record<string, ControllerNode>;
  services: ImportType[];
  openapi?: Record<string, unknown>;
}

export interface ControllerNode {
  metadata: HyperControllerMetadata;
  target: object;
  fullPath: string;
  routes: RouteNode[];
  services: ImportType[];
  openapi?: Record<string, unknown>;
}

export interface RouteNode extends RouteMetadata {
  fullPath: string;
  params: HyperParameterMetadata['params'];
  openapi?: Record<string, unknown>;
}

/**
 * Extracts the complete application metadata tree.
 */
export function getAppTree(Target: Constructor): AppTree {
  const root = Metadata.get<HyperMetadataStore>(Target);
  const common = root.server?.common as HyperAppMetadata | undefined;
  const prefix = common?.prefix || "/";

  const tree: AppTree = {
    app: { ...(common || {} as HyperAppMetadata), target: Target, fullPath: prefix } as AppTree['app'],
    modules: {},
    paths: {}
  };

  const modules = (common as HyperAppMetadata)?.modules || [];
  modules.forEach(m => {
    const node = getModuleNode(m, prefix, tree.paths);
    tree.modules[(m as Constructor).name] = node;
  });

  // Apply tree processors
  openApiRegistry.getProcessors().forEach(processor => processor(tree));

  return tree;
}

function getModuleNode(Target: Constructor, parentPath: string = "", globalPaths: Record<string, RouteNode[]> = {}): ModuleNode {
  const root = Metadata.get<HyperMetadataStore>(Target);
  const common = root.server?.common as HyperModuleMetadata;
  const currentPath = join(parentPath, common?.path || "");

  const openapi = SwaggerMeta.get(Target); // Fixed: Metadata utility now returns root.common

  // Execute custom collectors
  openApiRegistry.getCollectors("class").forEach(collector => {
    const extra = collector(Target);
    if (extra) Object.assign(openapi, extra);
  });

  const node: ModuleNode = {
    metadata: common,
    target: Target,
    fullPath: currentPath,
    modules: {},
    controllers: {},
    services: (common?.imports || []),
    openapi: openapi as Record<string, unknown>
  };

  (common?.modules || []).forEach(m => {
    node.modules[(m as Constructor).name] = getModuleNode(m, currentPath, globalPaths);
  });

  (common?.controllers || []).forEach(c => {
    node.controllers[(c as Constructor).name] = getControllerNode(c, currentPath, globalPaths);
  });

  return node;
}

function getControllerNode(Target: Constructor, parentPath: string = "", globalPaths: Record<string, RouteNode[]> = {}): ControllerNode {
  const root = Metadata.get<HyperMetadataStore>(Target);
  const common = root.server?.common as HyperControllerMetadata;

  const currentPath = join(parentPath, common?.path || "");
  const openapi = SwaggerMeta.get(Target);

  const server: HyperPrefixRoot = root.server || { common: {} as HyperCommonMetadata, methods: {} };
  const methods: Record<string, HyperMethodMetadata> = server.methods;
  const routes: RouteNode[] = Object.keys(methods).map((propertyKey) => {
    const methodMeta = methods[propertyKey];
    const route = methodMeta.route;
    if (!route) return null;

    const params = methodMeta.params?.params || [];
    const fullPath = join(currentPath, route.path);

    // Get OpenAPI metadata for the method
    const methodOpenApi = (SwaggerMeta.get(Target, propertyKey) || {}) as Record<string, unknown>;

    // Execute custom collectors
    openApiRegistry.getCollectors("method").forEach((collector) => {
      const extra = collector(Target, propertyKey);
      if (extra) Object.assign(methodOpenApi, extra);
    });

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
  }).filter(Boolean) as RouteNode[];

  // Execute custom collectors
  openApiRegistry.getCollectors("class").forEach(collector => {
    const extra = collector(Target);
    if (extra) Object.assign(openapi, extra);
  });

  return {
    metadata: common,
    target: Target,
    fullPath: currentPath,
    routes,
    services: common?.imports || [],
    openapi: openapi as Record<string, unknown>
  };
}
