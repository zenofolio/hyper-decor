import "reflect-metadata";
import { get } from "axios";
import { METADATA_KEYS } from "../constants";
import { MiddlewareHandler } from "hyper-express";

const { MIDDLEWARES } = METADATA_KEYS;

export const middlewareStore = Object.freeze({
  get(target: any) {
    return Reflect.getMetadata(MIDDLEWARES, target);
  },

  has(target: any) {
    return !!this.get(target);
  },

  set(target: any, ...middlewares: MiddlewareHandler[]) {
    const list = this.get(target) || [];
    list.push(...middlewares);

    Reflect.defineMetadata(MIDDLEWARES, list, target);
  },
});
