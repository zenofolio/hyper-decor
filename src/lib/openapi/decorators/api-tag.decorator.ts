import 'reflect-metadata';
import { apiTag } from '../helpers/tag.helper';
import { Tag } from '../types';

export function ApiTag(options: Tag | string) {
  return (target: any) => {
    if (typeof options === 'string') {
      options = { name: options };
    }
    apiTag(target, options);
  };
}