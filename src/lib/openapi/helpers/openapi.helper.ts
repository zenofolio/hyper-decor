import { AppTree, getAppTree } from "../../../__internals/helpers/tree.helper";
import { OpenAPIDocument, PathItem, Operation, OpenApiResponses } from "../types";

/**
 * Generates a complete OpenAPI 3.0.0 document from a HyperApp class.
 * 
 * @param App The HyperApp class (usually decorated with @HyperApp)
 */
export function getOpenAPI(App: any): OpenAPIDocument {
  const tree = getAppTree(App);
  const appMeta = tree.app as any;
  
  const doc: OpenAPIDocument = {
    openapi: "3.0.0",
    info: {
      title: appMeta.name || "API Documentation",
      version: appMeta.version || "1.0.0",
      description: appMeta.description || "",
    },
    paths: {},
    components: {
      schemas: {},
      securitySchemes: {},
      ...tree.openapi?.components
    }
  };

  // Populate paths from the flattened tree paths
  Object.entries(tree.paths).forEach(([path, routes]) => {
    // Convert /v1/user/ to /v1/user (remove trailing slash except for root)
    const normalizedPath = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
    
    if (!doc.paths[normalizedPath]) {
      doc.paths[normalizedPath] = {};
    }

    const pathItem: PathItem = doc.paths[normalizedPath]!;
    
    routes.forEach(route => {
      const method = route.method.toLowerCase();
      
      // Merge route-level OpenAPI metadata
      const operation: Operation = {
        ...route.openapi,
        responses: route.openapi?.responses || { 
          "200": { description: "Successful operation" } 
        }
      };

      // Ensure operationId if missing for better client generation
      if (!operation.operationId) {
        operation.operationId = `${route.propertyKey}`;
      }

      (pathItem as any)[method] = operation;
    });
  });

  // Apply any global tree processors that might have added data to tree.openapi
  if (tree.openapi) {
    Object.assign(doc, tree.openapi);
  }

  return doc;
}
