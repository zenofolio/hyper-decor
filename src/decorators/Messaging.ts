import { METADATA_KEYS } from "../__internals/constants";
import { defineDecorData } from "../__internals/decorator-base";

export interface OnMessageMetadata {
  topic: string;
  propertyKey: string;
}

/**
 * OnMessage decorator for subscribing to topics.
 * 
 * @param topic The topic or pattern to listen to (e.g. "user.created", "user.*")
 */
export const OnMessage = (topic: string) => {
  return (target: any, propertyKey: string | symbol | any, descriptor?: any) => {
    const existing: OnMessageMetadata[] = Reflect.getMetadata(METADATA_KEYS.ON_MESSAGE, target.constructor) ?? [];

    existing.push({
      topic,
      propertyKey: propertyKey.toString(),
    });

    defineDecorData(METADATA_KEYS.ON_MESSAGE, existing, target.constructor);
  };
};
