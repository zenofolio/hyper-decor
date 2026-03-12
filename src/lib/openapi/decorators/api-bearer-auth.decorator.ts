import 'reflect-metadata';
import { apiSecurity } from '../helpers/security.helper';

export function ApiBearerAuth(name: string = 'bearerAuth') {
  return (target: any, propertyKey?: any, descriptor?: any) => {
    apiSecurity(target, { [name]: [] }, propertyKey);
  };
}
