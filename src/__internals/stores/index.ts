import { $constructor } from "../utils/object.util";

interface MetadataStoreOptions {
  target: any;
  propertyKey?: string | symbol;
  descriptorOrIndex?: any;
}

class MetadatStore {
  static define(
    key: string | symbol,
    value: any,
    { target, propertyKey }: MetadataStoreOptions
  ) {
    if (target && typeof propertyKey === "string") {
      Reflect.defineMetadata(key, value, Reflect.get(target, propertyKey));
    } else {
      Reflect.defineMetadata(key, value, $constructor(target));
    }
  }

  static get<T>(
    key: string | symbol,
    { target, propertyKey }: MetadataStoreOptions,
    def: T
  ): T {
    if (target && typeof propertyKey === "string") {
      return Reflect.getMetadata(key, Reflect.get(target, propertyKey)) || def;
    } else {
      return Reflect.getMetadata(key, $constructor(target)) || def;
    }
  }

  static list<T extends any = any>(
    key: string | symbol,
    { target, propertyKey }: MetadataStoreOptions
  ) {
    return {
      has: () => {
        return this.get(key, { target, propertyKey }, []).length > 0;
      },
      get: () => {
        return this.get(key, { target, propertyKey }, []);
      },
      set: (...value: T[]) => {
        const list = this.get(key, { target, propertyKey }, []) as T[];
        list.push(...value);
        this.define(key, list, { target, propertyKey });
      },
    };
  }
}

export default MetadatStore;
