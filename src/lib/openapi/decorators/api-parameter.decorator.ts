import 'reflect-metadata';
import { apiParameter } from '../helpers/parameter.helper';
import { Parameter } from '../types';

export function ApiParameter(options: Parameter) {
  return (target: any, propertyKey: any) => {
    apiParameter(target, propertyKey, options);
  };
}
