import type {
  MiddlewareHandler,
  MiddlewareNext,
  Request,
  Response,
  ServerConstructorOptions,
} from "hyper-express";

import { InjectionToken, RegistrationOptions } from "tsyringe"
import { IMessageTransport, IMessageInterceptor } from "../../../common/transport";
import { IIdempotencyStore } from "../../../common/idempotency";

//////////////////////////
/// Boot Interfaces
//////////////////////////

export interface OnInit {
  onInit(): Promise<any>;
}

export interface IsSingleton {
  isSingleton(): boolean;
}

export type Constructor<R = object> = new (...args: any[]) => R;

export type ImportObject = {
  token: (abstract new (...args: any[]) => any) | InjectionToken;
  useClass?: Constructor;
  useValue?: any;
  useFactory?: (...args: any[]) => any;
  useToken?: InjectionToken;
  options?: RegistrationOptions;
};

export type ImportType =
  | Constructor<Partial<OnInit> & Partial<IsSingleton>>
  | InjectionToken
  | ImportObject;

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
  modules: boolean;
  controllers: boolean;
  middleware: boolean;
  routes: boolean;
  messaging: boolean;
}

export interface IHyperHooks {
  onBeforeInit?(instance: any, token: any, context: any): void | Promise<void>;
  onAfterInit?(instance: any, token: any, context: any): void | Promise<void>;
}

export interface HyperAppMetadata {
  name?: string;
  version?: string;
  description?: string;
  author?: string;
  license?: string;
  prefix?: string;
  logger?: (...args: any[]) => void;
  logs?: Partial<LogSpaces>;
  modules: Constructor[];
  imports?: ImportType[];
  options?: ServerConstructorOptions;
  uwsOptions?: any;
  transports?: (Constructor<IMessageTransport> | IMessageTransport)[];
  interceptor?: Constructor<IMessageInterceptor> | IMessageInterceptor;
  idempotency?: {
    enabled?: boolean;
    ttl?: number;
    store?: Constructor<IIdempotencyStore> | IIdempotencyStore;
    redisOptions?: any;
  };
  hooks?: IHyperHooks | Constructor<IHyperHooks>;
  bootstraps?: (Constructor<OnInit> | (() => Promise<void> | void))[];
}

export interface HyperAppDecorator {
  (options?: HyperAppMetadata): (target: Constructor) => Constructor;
}

///////////////////////////
/// Module Options
///////////////////////////

export type HyperModuleMetadata = {
  path?: string;
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

export type HyperParameterMetadata = {
  params: {
    index: number;
    type: Constructor | Function;
    source?: "body" | "query" | "params" | "headers" | "req" | "res";
    picker?: string;
    schema?: object | Function;
    isWholeSource?: boolean;
    name?: string;
    decorator: string;
    resolver?: ParameterResolver; // Can be pre-provided or built at startup
  }[];
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
 * Contains method, path, and other configuration for a specific method.
 */
export interface RouteMetadata {
  method: string;
  path: string;
  propertyKey: string;
  options?: Record<string, unknown>;
}

export abstract class MiddlewareClass {
  abstract handle(req: Request, res: Response, next: MiddlewareNext): void;
}

export interface MiddlewareClassConstructor {
  new(...args: any[]): MiddlewareClass;
}

/**
 * Type definition for Middleware.
 * Middleware can be a single handler or an array of handlers.
 */
export type MiddlewareType = MiddlewareHandler | MiddlewareClassConstructor;
