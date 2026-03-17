import { container } from "tsyringe";
import { MessageBus } from "./message-bus";
import { IHyperApp, IHyperApplication } from "../type";
import { HyperApplicationPrivate, HyperCommonMetadata } from "../__internals/types";
import { Server } from "hyper-express";
import { HyperMeta } from "../__internals/stores";
import { prepareApplication } from "../__internals/helpers/prepare.helper";
import { transformRegistry } from "../__internals/transform/transform.registry";
import { LogSpaces } from "../lib/server/decorators/types";

/**
 * Creates a new HyperApplication.
 *
 * @param app
 */
export async function createApplication<T extends IHyperApplication>(
  application: new (...args: any[]) => T
): Promise<IHyperApp<T>> {
  const metadata = HyperMeta.get(application) as HyperCommonMetadata;


  if (metadata.type !== "app") {
    throw new Error("Application must be decorated with @HyperApp");

  }
  const logger = metadata.logger || console.log;
  const logWrapper = (space: keyof LogSpaces, msg: string) => logger(`[${space}] ${msg}`);


  const appServer = await prepareApplication(metadata, application, logWrapper);
  const appInstance = container.resolve(application);

  const appProxy = new Proxy(appInstance as any, {
    get(target, prop) {
      if (prop === "useTransform") {
        return (transformer: any) => {
          transformRegistry.register(transformer);
          return appProxy;
        };
      }
      if (prop === "emit") {
        return async (topic: string, data: any) => {
          const bus = container.resolve(MessageBus);
          await bus.emit(topic, data);
        };
      }
      
      // Prioritize application instance methods/props
      if (prop in target) {
        const value = target[prop];
        return typeof value === "function" ? value.bind(target) : value;
      }

      // Fallback to hyper-express server
      const serverValue = (appServer as any)[prop];
      return typeof serverValue === "function" ? serverValue.bind(appServer) : serverValue;
    },
  });

  if ("onPrepare" in appInstance) {
    const onPrepare = (appInstance as any).onPrepare.bind(appInstance);
    await onPrepare();
  }

  return appProxy as unknown as IHyperApp<T>;
}
