import type {
  MiddlewareHandler,
  MiddlewareNext,
  Request,
  Response,
  ServerConstructorOptions,
} from "hyper-express";

//////////////////////////
/// Boot Interfaces
//////////////////////////

export interface OnInit {
  onInit(): Promise<any>;
}

export interface IsSingleton {
  isSingleton(): boolean;
}

export type Constructor<R extends any = any> = new (...args: any[]) => R;
export type ImportType = Constructor<Partial<OnInit> & Partial<IsSingleton>>;

export type ConstructorDecorator = (
  target: Constructor,
  kay?: any,
  descriptor?: PropertyDescriptor
) => Constructor;

export type HyperClassDecorator<T> = (options?: T) => ConstructorDecorator;

export type HyperMethodDecorator<T> = (
  options?: T
) => (target: any, key?: any, descriptor?: PropertyDescriptor) => void;

///////////////////////////
/// App Options
///////////////////////////

export interface LogSpaces {
  controllers: boolean;
  middleware: boolean;
  routes: boolean;
}

export interface HyperAppMetadata {
  name?: string;
  version?: string;
  description?: string;
  author?: string;
  license?: string;
  prefix?: string;
  logger?: (...args: any[]) => void;
  logs?: LogSpaces;
  modules: Constructor[];
  imports?: ImportType[];
  options?: ServerConstructorOptions;
}

export interface HyperAppDecorator {
  (options?: HyperAppMetadata): (target: Constructor) => Constructor;
}

///////////////////////////
/// Module Options
///////////////////////////

export type HyperModuleMetadata = {
  path: string;
  name?: string;
  roles?: string[];
  scopes?: string[];
  modules?: Constructor[];
  controllers?: Constructor[];
  imports?: ImportType[];
};

export type HyperModuleDecorator = HyperClassDecorator<HyperModuleMetadata>;

///////////////////////////
/// Controller Options
///////////////////////////

export type HyperControllerMetadata = {
  path?: string;
  roles?: string[];
  scopes?: string[];
  imports?: ImportType[];
};

export type HyperControllerDecorator = HyperClassDecorator<
  HyperControllerMetadata | string
>;

///////////////////////////
/// Route Options
///////////////////////////

export type ParameterResolver = (
  req: Request,
  res: Response
) => any | Promise<any>;

export type HyperParamerMetadata = {
  params: Record<
    string,
    {
      index: number;
      type: any;
      key: string;
      name: string;
      method: string;
      resolver: ParameterResolver;
    }[]
  >;
};

export type HyperParamDecorator = (
  key: string
) => (target: any, key: string, index: number) => void;

///////////////////////////
// Param Options
///////////////////////////

export type RoleMap<T> = {
  role: T;
  description: string;
  message?: string;
};

/**
 * Type definition for Role decorator.
 * It can accept a single role, an array of roles, or a function that evaluates roles dynamically.
 */
export type RoleType<T extends string = string> =
  | T
  | T[]
  | RoleMap<T>
  | RoleMap<T>[];

export type ScopeMap<T extends string = string> = {
  scope: T;
  description: string;
  message?: string;
};

/**
 * Type definition for Scope decorator.
 * It can accept a single scope or multiple scopes as an array of strings.
 */
export type ScopeType<T extends string = string> =
  | T
  | T[]
  | ScopeMap<T>
  | ScopeMap<T>[];

/**
 * Type definition for Route metadata.
 * Contains method, path, and handler function name.
 */
export interface RouteMetadata {
  className: string;
  method: string;
  path: string;
  propertyKey: string;
  options?: any;
  handler: (...args: any[]) => any;
}

export abstract class MiddlewareClass {
  abstract handle(req: Request, res: Response, next: MiddlewareNext): void;
}

export interface MiddlewareClassConstructor {
  new (...args: any[]): MiddlewareClass;
}

/**
 * Type definition for Middleware.
 * Middleware can be a single handler or an array of handlers.
 */
export type MiddlewareType = MiddlewareHandler | MiddlewareClassConstructor;
