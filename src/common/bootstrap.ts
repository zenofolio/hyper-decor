import { Server } from "hyper-express";
import { HyperApplicationPrivate } from "../__internals/types";
import { IHyperApp, IHyperApplication } from "../type";
import { container } from "tsyringe";
import { MessageBus } from "./message-bus";

export default async function createApplication<T extends IHyperApplication>(
  app: new (...args: any[]) => T
): Promise<IHyperApp<T>> {
  const instance = container.resolve(app) as HyperApplicationPrivate<T>;

  if (instance.prepare) {
    await instance.prepare();
  }

  instance?.onPrepare?.();

  instance.emit = async (topic: string, data: any) => {
    await MessageBus.emit(topic, data);
  };

  return instance as IHyperApp<T>;
}

export { createApplication };
