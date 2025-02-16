import type { Server } from "hyper-express";



export type HyperRoleOptions = string | string[];
export type HyperScopeOptions = string | string[];

export interface IHyperApplication extends Partial<Server> {
  onPrepare(): void;
}

export type IHyperApp<T> = T & Server;

export interface IHyperAppTarget {
  new (...args: any[]): IHyperApplication;
}
