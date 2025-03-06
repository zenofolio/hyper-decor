import 'reflect-metadata';
import { REQUEST_BODY_DESCRIPTION, REQUEST_BODY_CONTENT } from '../constants';
import { RequestBody } from '../types';

export function apiRequestBody(target: any, propertyKey: string, options: RequestBody) {
  Reflect.defineMetadata(REQUEST_BODY_DESCRIPTION, options.description, target, propertyKey);
  Reflect.defineMetadata(REQUEST_BODY_CONTENT, options.content, target, propertyKey);
}
