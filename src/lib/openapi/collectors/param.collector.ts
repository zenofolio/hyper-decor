import { PARAMETERS } from "../constants";
import { OpenApiParameter } from "../types";
import { KEY_PARAMS_PARAM } from "../../../__internals/constants";
import { transformRegistry } from "../../../__internals/transform/transform.registry";
import { extractArgsNames } from "../../../__internals/utils/function.util";
import { HyperParameterMetadata } from "../../../decorators/types";

export function collectParameterMetadata(
  target: any,
  methodName: string
): OpenApiParameter[] {
  const parameters: OpenApiParameter[] =
    Reflect.getMetadata(PARAMETERS, target, methodName) || [];

  const hyperParams: HyperParameterMetadata = Reflect.getMetadata(KEY_PARAMS_PARAM, target[methodName]);

  if (hyperParams && hyperParams.params[methodName]) {
    hyperParams.params[methodName].forEach((p) => {
      // Ignore body, req, res as they are not standard "parameters" in OpenAPI terms (body is separate)
      if (['req', 'res', 'body', 'BODY'].includes(p.key)) return;

      const locationMap: Record<string, string> = {
        'query': 'query',
        'params': 'path',
        'headers': 'header',
        'cookie': 'cookie'
      };

      const location = locationMap[p.key] || 'query';

      if (p.isWholeSource && p.schema) {
        const schema = transformRegistry.getOpenApiSchema(p.schema);
        if (schema && schema.properties) {
          Object.keys(schema.properties).forEach((propKey) => {
            parameters.push({
              name: propKey,
              in: location as any,
              required: (schema.required || []).includes(propKey),
              schema: schema.properties![propKey]
            });
          });
        }
      } else {
        parameters.push({
          name: p.name,
          in: location as any,
          required: true, // TODO: detect optionality from design:paramtypes or metadata
          schema: p.schema ? transformRegistry.getOpenApiSchema(p.schema) : { type: 'string' }
        });
      }
    });
  }

  // Fallback to design:paramtypes if no hyper-decor metadata found
  if (parameters.length === 0) {
    const methodParams = Reflect.getMetadata("design:paramtypes", target, methodName) || [];
    const paramNames = extractArgsNames(target[methodName]);

    methodParams.forEach((paramType: any, index: number) => {
      const name = paramNames && paramNames[index] ? paramNames[index] : `param${index}`;
      parameters.push({
        name,
        in: "query",
        required: true,
        schema: {
          type: paramType?.name?.toLowerCase() === 'number' ? 'number' : 'string',
        },
      });
    });
  }

  return parameters;
}
