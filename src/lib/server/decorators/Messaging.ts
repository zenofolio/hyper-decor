import "reflect-metadata";
import { HyperMeta } from "./metadata";
import { IMessageOptions, Transport } from "../../../common/transport";

/**
 * 🚀 SetMessageMetadata Decorator
 * Generic helper to inject metadata into a message handler.
 */
export const SetMessageMetadata = (key: string, value: any) => {
  return (target: any, propertyKey: any) => {
    HyperMeta.set(target, propertyKey, {
      [key]: value
    });
  };
};

/**
 * 🚀 OnMessage Decorator
 * Purely injects message subscription metadata into the method.
 * 
 * @param topic The topic or pattern to listen to (e.g. "user.created", "user.*")
 * @param options Optional subscription options (e.g. concurrency, transport-specific settings)
 */
export const OnMessage = (topic: string, options?: IMessageOptions) => {
  return SetMessageMetadata("onMessage", { topic, options });
};

/**
 * 🚀 OnInternal Decorator
 * Shortcut for OnMessage with transport forced to INTERNAL.
 */
export const OnInternal = (topic: string, options?: Omit<IMessageOptions, "transport">) => {
  return OnMessage(topic, { ...options, transport: Transport.INTERNAL });
};

/**
 * 🚀 OnTransport Decorator
 * Shortcut for OnMessage with a specific transport target.
 */
export const OnTransport = (transport: Transport | string, topic: string, options?: Omit<IMessageOptions, "transport">) => {
  return OnMessage(topic, { ...options, transport });
};
