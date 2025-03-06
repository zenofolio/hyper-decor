import 'reflect-metadata';
import { METHOD_SUMMARY, RESPONSES, PARAMETERS, REQUEST_BODY_CONTENT, REQUEST_BODY_DESCRIPTION, METHOD_TAGS, METHOD_OPERATION_ID } from '../constants';
import { Operation, Parameter, Response, RequestBody } from '../types';
import { collectParameterMetadata } from './param.collector'; // Importamos el colector de parámetros

export function collectMethodMetadata(target: any, methodName: string): Operation {
  const methodMetadata: any = {};

  // Extraemos la metadata del método
  const summary = Reflect.getMetadata(METHOD_SUMMARY, target, methodName);
  const operationId = Reflect.getMetadata(METHOD_OPERATION_ID, target, methodName);
  const tags = Reflect.getMetadata(METHOD_TAGS, target, methodName);
  
  // Extraemos las respuestas del método
  const responses: Response = Reflect.getMetadata(RESPONSES, target, methodName) || {};
  
  // Extraemos los parámetros del método
  const parameters: Parameter[] = collectParameterMetadata(target, methodName);
  
  // Extraemos la información del cuerpo de la solicitud
  const requestBody: RequestBody = {
    description: Reflect.getMetadata(REQUEST_BODY_DESCRIPTION, target, methodName),
    content: Reflect.getMetadata(REQUEST_BODY_CONTENT, target, methodName),
  };

  // Asignamos las propiedades al objeto de metadata solo si existen
  if (summary) methodMetadata.summary = summary;
  if (operationId) methodMetadata.operationId = operationId;
  if (tags) methodMetadata.tags = tags;
  if (responses && Object.keys(responses).length > 0) methodMetadata.responses = responses;
  if (parameters.length > 0) methodMetadata.parameters = parameters;
  if (requestBody.content) methodMetadata.requestBody = requestBody;

  return methodMetadata;
}
