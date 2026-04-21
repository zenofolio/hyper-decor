import type { Server } from "hyper-express";

declare module "hyper-express" {
  interface Request {
    setValue(key: string, value: any): void;
    getValue<T>(key: string, defaultValue?: T): T;
  }
}

import { TransformerInput } from "./__internals/transform/transform.registry";

export type HyperRoleOptions = string | string[];
export type HyperScopeOptions = string | string[];

import { IMessageEmitOptions } from "./common/transport";

export interface IHyperApplication extends Partial<Server> {
  onPrepare?(): void;
  emit?(topic: string, data: any, options?: IMessageEmitOptions): Promise<void>;
}

export type IHyperApp<T> = T & Server & {
  emit(topic: string, data: any, options?: IMessageEmitOptions): Promise<void>;
  useTransform(transformer: TransformerInput): IHyperApp<T>;
};

export interface IHyperAppTarget {
  new(...args: any[]): IHyperApplication;
}
