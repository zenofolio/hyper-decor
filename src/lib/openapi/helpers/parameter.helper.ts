import 'reflect-metadata';
import { PARAMETERS } from '../constants';
import { OpenApiParameter } from '../types';

export function apiParameter(target: any, propertyKey: string, options: OpenApiParameter) {
  const existingParameters: OpenApiParameter[] = Reflect.getMetadata(PARAMETERS, target, propertyKey) || [];
  existingParameters.push({
    name: options.name,
    in: options.in,
    required: options.required || false,
    description: options.description,
    schema: options.schema,
  });
  Reflect.defineMetadata(PARAMETERS, existingParameters, target, propertyKey);
}
