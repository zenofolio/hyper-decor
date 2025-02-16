import {
  getMetadata,
  defineMetadata,
  deleteMetadata,
} from "reflect-metadata/no-conflict";
import { Request, Response } from "hyper-express";

import { DESIGN_PARAMTYPES, KEY_PARAMS_PARAM} from "../constants";

export type ByPassKeys = "req" | "res";

export type IParamsResolver = (
  req: Request,
  res: Response
) => any | Promise<any>;

export type IStoreParams = {
  name: string;
  type: any;
  index: number;
  key: string;
  propertyKey: string;
  resolver: IParamsResolver;
};

export type IStoreParamsMap = Map<string, IStoreParams>;

export const paramsStore = Object.freeze({
  has(target: any, propety: any, key: string) {
    const data = this.get(target, propety);
    return data ? data.has(key) : false;
  },

  get(target: any, propety?: any): IStoreParamsMap | undefined {
    if (!propety) {
      return getMetadata(KEY_PARAMS_PARAM, target);
    }

    return getMetadata(KEY_PARAMS_PARAM, target, propety);
  },

  set(target: any, propety: any, value: IStoreParams) {
    const data = this.get(target, propety) || new Map();
    data.set(value.key, value);
    defineMetadata(KEY_PARAMS_PARAM, data, target, propety);
  },

  delete(target: any, propety: any) {
    deleteMetadata(KEY_PARAMS_PARAM, target, propety);
  },

  support(target: any, propety: any) {
    const params = getMetadata(DESIGN_PARAMTYPES, target, propety) || [];
    return params.length > 0;
  },

  async prepareArgs(target: any, propety: any, req: Request, res: Response) {
    const data = this.get(target, propety);
    if (!data) return [];

    const args: any[] = [];

    await Promise.all(
      Array.from(data.values()).map(async (value) => {
        const { key, resolver } = value;

        switch (key) {
          case "req":
            args[value.index] = req;
            break;
          case "res":
            args[value.index] = res;
            break;
          default: {
            const result = await resolver(req, res);
            args[value.index] = result;
          }
        }
      })
    );

    return args;
  },

  async intercept(target: any, propety: any, req: Request, res: Response) {},
});
