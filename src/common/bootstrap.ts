import { Server, ServerConstructorOptions } from "hyper-express";
import { HyperApplicationPrivate } from "../__internals/types";
import { IHyperApp, IHyperApplication } from "../type";
import { container } from "tsyringe";

export default async function createApplication<T extends IHyperApplication>(
  app: new (...args: any[]) => T): Promise<IHyperApp<T>> {
  const instance = container.resolve(app) as HyperApplicationPrivate<T>;

  if (instance.prepare) {
    await instance.prepare();
  }

  instance?.onPrepare?.();

  return instance as Server & T;
}

export { createApplication };
