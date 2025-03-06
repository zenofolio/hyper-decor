import 'reflect-metadata';
import { TAGS } from '../constants';
import { Tag } from '../types';

export function apiTag(target: any, options: Tag) {
  const existingTags = Reflect.getMetadata(TAGS, target) || [];
  existingTags.push({ name: options.name, description: options.description });
  Reflect.defineMetadata(TAGS, existingTags, target);
}
