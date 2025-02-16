export interface IStore<T> {
  has(target: any, property: any): boolean;
  get(target: any, property: any): T | undefined;
  set(target: any, property: any, value: T): void;
  create(target: any, property: any, extra?: Partial<T>): T | null;
  delete(target: any, property?: any): void;
  support(target: any, property: any): boolean;
}
