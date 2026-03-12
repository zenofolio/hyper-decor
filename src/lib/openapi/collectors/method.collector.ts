import { METHOD_SUMMARY, RESPONSES, PARAMETERS, REQUEST_BODY_CONTENT, REQUEST_BODY_DESCRIPTION, METHOD_TAGS, METHOD_OPERATION_ID, SECURITY } from '../constants';
import { Operation, Parameter, Response, Responses, RequestBody, SecurityRequirement } from '../types';
import { collectParameterMetadata } from './param.collector';
import { KEY_PARAMS_TRANSFORM } from '../../../__internals/constants';
import { openApiRegistry } from '../metadata.registry';
import { getDecorData } from '../../../__internals/decorator-base';
import { transformRegistry } from '../../../__internals/transform/transform.registry';

export function collectMethodMetadata(target: any, methodName: string): Operation {
  const methodMetadata: any = {};

  // Extraemos la metadata del método
  const summary = Reflect.getMetadata(METHOD_SUMMARY, target, methodName);
  const operationId = Reflect.getMetadata(METHOD_OPERATION_ID, target, methodName);
  const tags = Reflect.getMetadata(METHOD_TAGS, target, methodName);
  const security: SecurityRequirement[] = Reflect.getMetadata(SECURITY, target, methodName);
  
  // Extraemos las respuestas del método
  const responses: Responses = Reflect.getMetadata(RESPONSES, target, methodName) || {};
  
  // Extraemos los parámetros del método
  const parameters: Parameter[] = collectParameterMetadata(target, methodName);
  
  // Extraemos la información del cuerpo de la solicitud
  const requestBody: RequestBody = {
    description: Reflect.getMetadata(REQUEST_BODY_DESCRIPTION, target, methodName),
    content: Reflect.getMetadata(REQUEST_BODY_CONTENT, target, methodName),
  };

  // Bridging @Transform to OpenAPI
  const transform = getDecorData<any>(KEY_PARAMS_TRANSFORM, target, methodName);
  if (transform) {
    const openApiSchema = transformRegistry.getOpenApiSchema(transform.schema);
    if (openApiSchema) {
      const from = transform.options.from || 'body';

      if (from === 'body') {
        requestBody.content = requestBody.content || {};
        requestBody.content['application/json'] = {
          schema: openApiSchema
        };
      }
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
