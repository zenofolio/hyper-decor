import {
  defineMetadata,
  deleteMetadata,
  getMetadata,
  hasMetadata,
} from "reflect-metadata/no-conflict";
import { IStore } from "./store.interface";
import { METADATA_KEYS } from "../constants";

interface IRoute {
  className: string;
  method: string;
  path: string;
  handler: (...args: any[]) => any;
}

export class RouteStore implements IStore<any> {
  has(target: any, property?: any): boolean {
    return hasMetadata(METADATA_KEYS.ROUTES, target);
  }

  get(target: any, property?: any): Set<IRoute> | undefined {
    return getMetadata(METADATA_KEYS.ROUTES, target);
  }

  set(target: any, property: any, value: IRoute): void {
    const routes = this.get(target) || new Set();
    routes.add(value);
    defineMetadata(METADATA_KEYS.ROUTES, routes, target);
  }

  create(target: any, property?: any, key?: any): Set<IRoute> | null {
    const data = this.has(target, property)
      ? this.get(target, property)
      : new Set();
    defineMetadata(METADATA_KEYS.ROUTES, data, target);

    return data as Set<IRoute>;
  }

  delete(target: any, value?: IRoute): void {
    const routes = this.create(target, value?.className);
    if (!routes) return;

    if (value) {
      routes.delete(value);
      defineMetadata(METADATA_KEYS.ROUTES, routes, target);
    } else {
      deleteMetadata(METADATA_KEYS.ROUTES, target);
    }
  }

  support(target: any, property: any) {
    return this.has(target, property);
  }
}

const routeStore = new RouteStore();

export { routeStore };
