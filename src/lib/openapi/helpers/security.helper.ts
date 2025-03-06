import 'reflect-metadata';
import { SECURITY } from '../constants';
import { SecurityRequirement } from '../types';

export function apiSecurity(target: any, options: SecurityRequirement) {
  const existingSecurity = Reflect.getMetadata(SECURITY, target) || [];
  existingSecurity.push(options);
  Reflect.defineMetadata(SECURITY, existingSecurity, target);
}
