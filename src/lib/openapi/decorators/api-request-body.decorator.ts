import 'reflect-metadata';
import { apiRequestBody } from '../helpers/request-body.helper';
import { RequestBody } from '../types';

export function ApiRequestBody(options: RequestBody) {
  return (target: any, propertyKey: string) => {
    apiRequestBody(target, propertyKey, options);
  };
}
