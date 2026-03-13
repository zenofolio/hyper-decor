import { METHOD_SUMMARY, RESPONSES, PARAMETERS, REQUEST_BODY_CONTENT, REQUEST_BODY_DESCRIPTION, METHOD_TAGS, METHOD_OPERATION_ID, SECURITY } from '../constants';
import { Operation, OpenApiParameter, OpenApiResponse, OpenApiResponses, RequestBody, SecurityRequirement, OpenAPIDocument, PathItem } from '../types';
import { collectParameterMetadata } from './param.collector';
import { KEY_PARAMS_PARAM, KEY_OUTPUT_SCHEMA, DESIGN_RETURNTYPE } from '../../../__internals/constants';
import { openApiRegistry } from '../metadata.registry';
import { getDecorData } from '../../../__internals/decorator-base';
import { transformRegistry } from '../../../__internals/transform/transform.registry';
import { HyperParameterMetadata } from '../../../decorators/types';

export function collectMethodMetadata(target: any, methodName: string): Operation {
  const methodMetadata: any = {};

  // Extraemos la metadata del método
  const summary = Reflect.getMetadata(METHOD_SUMMARY, target, methodName);
  const operationId = Reflect.getMetadata(METHOD_OPERATION_ID, target, methodName);
  const tags = Reflect.getMetadata(METHOD_TAGS, target, methodName);
  const security: SecurityRequirement[] = Reflect.getMetadata(SECURITY, target, methodName);

  // Extraemos las respuestas del método
  const responses: OpenApiResponses = Reflect.getMetadata(RESPONSES, target, methodName) || {};

  // Extraemos los parámetros del método
  const parameters: OpenApiParameter[] = collectParameterMetadata(target, methodName);

  // Extraemos la información del cuerpo de la solicitud
  const requestBody: RequestBody = {
    description: Reflect.getMetadata(REQUEST_BODY_DESCRIPTION, target, methodName),
    content: Reflect.getMetadata(REQUEST_BODY_CONTENT, target, methodName),
  };

  // Bridge @Body to OpenAPI
  const hyperParams: HyperParameterMetadata = Reflect.getMetadata(KEY_PARAMS_PARAM, target[methodName]);
  
  if (hyperParams && hyperParams.params[methodName]) {
    const bodyParam = hyperParams.params[methodName].find(p => ['body', 'BODY', 'req'].includes(p.key));
    if (bodyParam) {
      const targetSchema = bodyParam.schema;
      if (targetSchema) {
        const bodySchema = transformRegistry.getOpenApiSchema(targetSchema);
        if (bodySchema) {
          requestBody.content = requestBody.content || {};
          requestBody.content['application/json'] = {
            schema: bodySchema
          };
        }
      }
    }
  }

  // Bridging @Output / return type to OpenAPI
  const outputSchema = Reflect.getMetadata(KEY_OUTPUT_SCHEMA, target, methodName)
    || Reflect.getMetadata(DESIGN_RETURNTYPE, target, methodName);

  if (outputSchema && outputSchema !== Object && outputSchema !== Promise) {
    const schema = transformRegistry.getOpenApiSchema(outputSchema);
    if (schema) {
      responses['200'] = responses['200'] || { description: 'Success' };
      responses['200'].content = responses['200'].content || {};
      responses['200'].content['application/json'] = { schema };
    }
  }

  // Asignamos las propiedades al objeto de metadata solo si existen
  if (summary) methodMetadata.summary = summary;
  if (operationId) methodMetadata.operationId = operationId;
  if (tags) methodMetadata.tags = tags;
  if (security) methodMetadata.security = security;
  if (responses && Object.keys(responses).length > 0) methodMetadata.responses = responses;
  if (parameters.length > 0) methodMetadata.parameters = parameters;
  if (requestBody.content) methodMetadata.requestBody = requestBody;

  return methodMetadata;
}
