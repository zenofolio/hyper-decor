import 'reflect-metadata';
import { apiParameter } from '../helpers/parameter.helper';
import { OpenApiParameter } from '../types';

export function ApiParameter(options: OpenApiParameter) {
  return (target: any, propertyKey: any) => {
    apiParameter(target, propertyKey, options);
  };
}
