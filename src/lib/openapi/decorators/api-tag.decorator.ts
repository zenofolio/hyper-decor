import 'reflect-metadata';
import { apiTag } from '../helpers/tag.helper';
import { Tag } from '../types';

export function ApiTag(options: Tag) {
  return (target: any) => {
    apiTag(target, options);
  };
}