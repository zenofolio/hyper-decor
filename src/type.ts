import type { Server } from "hyper-express";



export type HyperRoleOptions = string | string[];
export type HyperScopeOptions = string | string[];

export interface IHyperApplication extends Partial<Server> {
  onPrepare?(): void;
  emit?(topic: string, data: any): Promise<void>;
}

export type IHyperApp<T> = T & Server & {
  emit(topic: string, data: any): Promise<void>;
};

export interface IHyperAppTarget {
  new (...args: any[]): IHyperApplication;
}
