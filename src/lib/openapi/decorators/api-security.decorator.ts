import 'reflect-metadata';
import { apiSecurity } from '../helpers/security.helper';
import { SecurityRequirement } from '../types';

export function ApiSecurity(options: SecurityRequirement) {
  return (target: any) => {
    apiSecurity(target, options);
  };
}