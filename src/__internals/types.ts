import { RouteMetadata } from "../decorators";

export interface RouterList {
  type: string;
  routes: Set<RouteMetadata>;
}

export type HyperApplicationPrivate<T> = T & {
  prepare(): Promise<void>;
};
