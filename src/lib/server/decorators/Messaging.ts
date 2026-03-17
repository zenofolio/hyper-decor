import "reflect-metadata";
import { HyperMeta } from "./metadata";

/**
 * 🚀 OnMessage Decorator
 * Purely injects message subscription metadata into the method.
 * 
 * @param topic The topic or pattern to listen to (e.g. "user.created", "user.*")
 */
export const OnMessage = (topic: string) => {
  return (target: any, propertyKey: any) => {
    HyperMeta.set(target, propertyKey, {
      onMessage: { topic }
    });
  };
};
