import 'reflect-metadata';
import { SECURITY } from '../constants';
import { SecurityRequirement } from '../types';

export function apiSecurity(target: any, options: SecurityRequirement, propertyKey?: string) {
  const existingSecurity = propertyKey
    ? Reflect.getMetadata(SECURITY, target, propertyKey) || []
    : Reflect.getMetadata(SECURITY, target) || [];
  
  existingSecurity.push(options);
  
  if (propertyKey) {
    Reflect.defineMetadata(SECURITY, existingSecurity, target, propertyKey);
  } else {
    Reflect.defineMetadata(SECURITY, existingSecurity, target);
  }
}
