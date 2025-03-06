import 'reflect-metadata';
import { PARAMETERS } from '../constants';
import { Parameter } from '../types';

export function apiParameter(target: any, propertyKey: string, options: Parameter) {
  const existingParameters = Reflect.getMetadata(PARAMETERS, target, propertyKey) || [];
  existingParameters.push({
    name: options.name,
    in: options.in,
    required: options.required || false,
    description: options.description,
    schema: options.schema,
  });
  Reflect.defineMetadata(PARAMETERS, existingParameters, target, propertyKey);
}
