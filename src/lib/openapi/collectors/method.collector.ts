import "reflect-metadata";
import { SwaggerMeta } from '../metadata';
import { 
  Operation, 
  OpenApiParameter, 
  OpenApiResponses, 
  RequestBody, 
  MediaType,
  Schema 
} from '../types';
import { Constructor } from '../../server/decorators/types';
import { HyperMeta } from '../../server/decorators/metadata';
import { transformRegistry } from '../../../__internals/transform/transform.registry';
import { KEY_OUTPUT_SCHEMA } from '../../../__internals/constants';
import { collectSchema } from './schema.collector';

import { HyperMethodMetadata } from '../../../__internals/types';

/**
 * 🛠️ Consolidates framework metadata and OpenAPI decorators into a single Operation object.
 */
export function collectMethodMetadata(target: Constructor, propertyKey?: string): Operation | undefined {
    if (!propertyKey) return undefined;

    // 1. Get user-defined OpenAPI metadata from decorators
    const baseOperation = SwaggerMeta.get(target, propertyKey) as Operation;
    
    // 2. Get framework metadata (params, route, etc.)
    const hyperMeta = HyperMeta.get(target, propertyKey) as HyperMethodMetadata;
    
    const operation: Operation = {
        ...baseOperation,
        parameters: [...(baseOperation.parameters || [])],
        responses: { ...(baseOperation.responses || {}) }
    };

    // 3. Bridge Parameters (@Query, @Param, @Headers)
    if (hyperMeta.params?.params) {
        hyperMeta.params.params.forEach((param) => {
            const inType = mapParamIn(param.decorator);
            if (!inType) return; // Skip 'body' or unknown

            // Use the key as the name if it's specified, otherwise fall back to name/decorator
            const name = (typeof param.key === 'string' && !['query', 'params', 'headers', 'body'].includes(param.key.toLowerCase())) 
                ? param.key 
                : (param.name || param.decorator || 'param');

            const schema = param.schema 
                ? (transformRegistry.getOpenApiSchema(param.schema) || collectSchema(param.schema))
                : { type: 'string' };

            // If it's an object, we might want to explode it (if it's Query/Headers)
            if (schema.type === 'object' && schema.properties && (inType === 'query' || inType === 'header')) {
                Object.entries(schema.properties).forEach(([propName, prop]) => {
                    operation.parameters!.push({
                        name: propName,
                        in: inType,
                        required: true,
                        schema: prop as Schema
                    });
                });
            } else {
                operation.parameters!.push({
                    name,
                    in: inType,
                    required: inType === 'path' ? true : undefined,
                    schema
                });
            }
        });
    }

    // 4. Bridge Request Body (@Body)
    const bodyParam = hyperMeta.params?.params?.find((p) => p.decorator === 'Body');
    if (bodyParam && !operation.requestBody) {
        let schema = bodyParam.schema 
            ? (transformRegistry.getOpenApiSchema(bodyParam.schema) || collectSchema(bodyParam.schema))
            : { type: 'object' };

        // If a specific key was requested, wrap the schema in an object
        if (typeof bodyParam.key === 'string' && bodyParam.key !== 'body') {
            schema = {
                type: 'object',
                properties: {
                    [bodyParam.key]: schema
                },
                required: [bodyParam.key]
            };
        }

        operation.requestBody = {
            content: {
                "application/json": { schema }
            }
        };
    }

    // 5. Bridge Responses (@Output)
    const outputSchema = baseOperation.responses?.["200"]?.content?.["application/json"]?.schema
        || (hyperMeta as Record<string, unknown>)[KEY_OUTPUT_SCHEMA]
        || hyperMeta.output;

    if (outputSchema && !operation.responses["200"]) {
        const schema = transformRegistry.getOpenApiSchema(outputSchema) || collectSchema(outputSchema);
        operation.responses["200"] = {
            description: "OK",
            content: {
                "application/json": { schema }
            }
        };
    } else if (Object.keys(operation.responses).length === 0) {
        operation.responses["200"] = { description: "OK" };
    }

    return operation;
}

function mapParamIn(decorator: string): "query" | "header" | "path" | undefined {
    switch (decorator.toLowerCase()) {
        case 'query': return 'query';
        case 'param': return 'path';
        case 'headers': return 'header';
        default: return undefined;
    }
}
