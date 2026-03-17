import { SwaggerMeta } from "./metadata";
import { Tag, OpenApiResponses, OpenApiParameter, RequestBody, SecurityRequirement, Operation } from "./types";

/**
 * 📝 OpenAPI Decorators consolidated for better performance and clean imports.
 */

export function ApiSummary(summary: string) {
  return (target: any, propertyKey: any) => {
    SwaggerMeta.set(target, propertyKey, { summary });
  };
}

export function ApiDescription(description: string) {
  return (target: any, propertyKey: any) => {
    SwaggerMeta.set(target, propertyKey, { description });
  };
}

export function ApiOperationId(operationId: string) {
  return (target: any, propertyKey: any) => {
    SwaggerMeta.set(target, propertyKey, { operationId });
  };
}

export function ApiTag(options: Tag | string) {
  const tag = typeof options === 'string' ? { name: options } : options;
  return (target: any, propertyKey?: any) => {
    if (propertyKey) {
      const current = SwaggerMeta.get(target, propertyKey) as Partial<Operation>;
      const tags = [...(current.tags || []), tag];
      // Use Map to deduplicate by name
      const uniqueTags = Array.from(new Map(tags.map(t => [t.name, t])).values());
      SwaggerMeta.set(target, propertyKey, { tags: uniqueTags });
    } else {
      const current = SwaggerMeta.get(target) as Partial<Operation>;
      const tags = [...(current.tags || []), tag];
      const uniqueTags = Array.from(new Map(tags.map(t => [t.name, t])).values());
      SwaggerMeta.set(target, undefined, { tags: uniqueTags });
    }
  };
}

export function ApiResponse(options: OpenApiResponses) {
  return (target: any, propertyKey?: any) => {
    SwaggerMeta.set(target, propertyKey, { responses: options });
  };
}

export function ApiParameter(options: OpenApiParameter) {
  return (target: any, propertyKey: any) => {
    const current = SwaggerMeta.get(target, propertyKey) as Partial<Operation>;
    const parameters = [...(current.parameters || []), options];
    SwaggerMeta.set(target, propertyKey, { parameters });
  };
}

export function ApiRequestBody(options: RequestBody) {
  return (target: any, propertyKey: any) => {
    SwaggerMeta.set(target, propertyKey, { requestBody: options });
  };
}

export function ApiSecurity(options: SecurityRequirement) {
  return (target: any, propertyKey?: any) => {
    const current = SwaggerMeta.get(target, propertyKey) as Partial<Operation>;
    const security = [...(current.security || []), options];
    SwaggerMeta.set(target, propertyKey, { security });
  };
}

export function ApiBearerAuth(name: string = 'bearerAuth') {
  return ApiSecurity({ [name]: [] });
}

export function ApiMethod(options: Partial<Operation>) {
  return (target: any, propertyKey: any) => {
    SwaggerMeta.set(target, propertyKey, options);
  };
}

export function ApiNamespace(name: string) {
  return (target: any, propertyKey?: any) => {
    SwaggerMeta.set(target, propertyKey, { namespace: name });
  };
}

export function ApiIgnore() {
  return (target: any, propertyKey?: any) => {
    SwaggerMeta.set(target, propertyKey, { ignore: true });
  };
}
