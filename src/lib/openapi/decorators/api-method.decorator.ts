import "reflect-metadata";
import { apimethod } from "../helpers/method.helper";
import { Operation } from "../types";

export function ApiMethod(options: Partial<Operation>) {
  return <T>(target: any, propertyKey?: any, descriptor?: TypedPropertyDescriptor<T>): any => {
    apimethod(target, propertyKey, options);

    return descriptor;
  };
}
