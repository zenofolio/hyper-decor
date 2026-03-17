export * from "./types";


import {
    ApiBearerAuth,
    ApiDescription,
    ApiOperationId,
    ApiParameter,
    ApiRequestBody,
    ApiResponse,
    ApiSecurity,
    ApiSummary,
    ApiTag,
    ApiMethod,
    ApiNamespace,
    ApiIgnore,
} from "./decorators";



export const OpenApi = {
    Summary: ApiSummary,
    Description: ApiDescription,
    OperationId: ApiOperationId,
    Tag: ApiTag,
    Response: ApiResponse,
    Parameter: ApiParameter,
    RequestBody: ApiRequestBody,
    Security: ApiSecurity,
    BearerAuth: ApiBearerAuth,
    Method: ApiMethod,
    Namespace: ApiNamespace,
    Ignore: ApiIgnore,
};


export {
    ApiBearerAuth,
    ApiDescription,
    ApiOperationId,
    ApiParameter,
    ApiRequestBody,
    ApiResponse,
    ApiSecurity,
    ApiSummary,
    ApiTag,
    ApiMethod,
    ApiNamespace,
    ApiIgnore,
}

import { getAppTree, ModuleNode, ControllerNode, RouteNode } from "../tree/tree";
import { transformRegistry } from "../../__internals/transform/transform.registry";
import { HyperMeta } from "../server/decorators/metadata";
import { KEY_OUTPUT_SCHEMA } from "../../__internals/constants";
import { openApiRegistry } from "./metadata.registry";
import { Constructor } from "../server/decorators/types";
import { OpenAPIDocument, Operation } from "./types";

// --- Registration ---
import { collectClassMetadata, collectMethodMetadata } from "./collectors";

openApiRegistry.registerCollector("class", collectClassMetadata);
openApiRegistry.registerCollector("method", collectMethodMetadata);

/**
 * Generates an OpenAPI specification object from a HyperApp class.
 * 
 * @param App The Root Application Class
 * @param options Generator options
 * @returns OpenAPI Spec Object
 */
export function getOpenAPI(App: Constructor, options: {
    includeNamespaces?: string[],
    excludeNamespaces?: string[]
} = {}): OpenAPIDocument {
    const tree = getAppTree(App);

    const spec: OpenAPIDocument = {
        openapi: "3.0.0",
        info: {
            title: tree.app.name || "HyperApp API",
            version: tree.app.version || "1.0.0",
        },
        paths: {},
    };

    const processController = (ctrl: ControllerNode, parentNamespace?: string): void => {
        const ctrlOpenApi = ctrl.openapi as { ignore?: boolean; namespace?: string } | undefined;
        if (ctrlOpenApi?.ignore) return;
        const ctrlNamespace = ctrlOpenApi?.namespace || parentNamespace;

        ctrl.routes.forEach((route: RouteNode) => {
            const routeOpenApi = route.openapi as Record<string, unknown> & Partial<Operation>;
            if (!routeOpenApi || (routeOpenApi as any).ignore) return;
            const path = normalizePath(route.fullPath);
            if (!spec.paths[path]) spec.paths[path] = {};

            const methodNamespace = (routeOpenApi as any).namespace as string | undefined || ctrlNamespace;

            // Filtering logic
            if (options.includeNamespaces && options.includeNamespaces.length > 0) {
                if (!methodNamespace || !options.includeNamespaces.includes(methodNamespace)) return;
            }
            if (options.excludeNamespaces && options.excludeNamespaces.length > 0) {
                if (methodNamespace && options.excludeNamespaces.includes(methodNamespace)) return;
            }

            // --- Merge Metadata Inheritance ---
            const ctrlData = (ctrl.openapi || {}) as Partial<Operation>;
            const finalOperation: Operation = {
                responses: {},
                ...ctrlData,
                ...routeOpenApi,
                // Merge Tags (unique by name)
                tags: Array.from(new Map<string, any>([
                    ...(ctrlData.tags || []).map(t => [t.name, t] as [string, any]),
                    ...(routeOpenApi.tags || []).map(t => [t.name, t] as [string, any])
                ]).values()),
                // Merge Security (additive)
                security: [
                    ...(ctrlData.security || []),
                    ...(routeOpenApi.security || [])
                ]
            };

            // Remove empty fields to keep spec clean
            if (finalOperation.tags?.length === 0) delete finalOperation.tags;
            if (finalOperation.security?.length === 0) delete finalOperation.security;

            spec.paths[path] = {
                ...spec.paths[path],
                [route.method.toLowerCase()]: finalOperation
            };
        });

        // Clean up empty paths if all methods were filtered out
        Object.keys(spec.paths).forEach(path => {
            if (Object.keys(spec.paths[path]).length === 0) {
                delete spec.paths[path];
            }
        });
    };

    function normalizePath(path: string): string {
        let normalized = path.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
        // Remove trailing slash if it's not the root path
        if (normalized.length > 1 && normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1);
        }
        return normalized;
    }

    const processModule = (mod: ModuleNode): void => {
        const modNamespace = (mod.openapi as { namespace?: string })?.namespace;
        Object.values(mod.controllers).forEach(ctrl => processController(ctrl, modNamespace));
        Object.values(mod.modules).forEach(processModule);
    };

    Object.values(tree.modules).forEach(processModule);

    return spec;
}
