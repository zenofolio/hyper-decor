import {
  HyperAppMetadata,
  HyperModuleMetadata,
  HyperControllerMetadata,
  HyperParameterMetadata,
  RouteMetadata,
  Constructor,
  MiddlewareType,
  ScopeType,
  RoleType,
  IHyperAppOptions
} from "../lib/server/decorators/types";


/**
 * 🛠️ Shared Class-Level Metadata Keys
 */
export interface HyperBaseCommon {
  middlewares?: MiddlewareType[];
  scopes?: ScopeType[];
  roles?: RoleType[];
  pass?: unknown;
}

/**
 * 📦 Hierarchical Metadata Structure for Components
 */
export type HyperCommonMetadata =
  | (HyperAppMetadata & HyperBaseCommon & { type: 'app' })
  | (HyperModuleMetadata & HyperBaseCommon & { type: 'module' })
  | (HyperControllerMetadata & HyperBaseCommon & { type: 'controller' })
  | (HyperBaseCommon & { type: 'service' });

import { IMessageOptions } from "../common/transport";

/**
 * 📡 Hierarchical Metadata Structure for Methods
 */
export interface HyperMethodMetadata {
  route?: RouteMetadata;
  params?: HyperParameterMetadata;
  middlewares?: MiddlewareType[];
  scopes?: ScopeType[];
  roles?: RoleType[];
  onMessage?: { topic: string, options?: IMessageOptions };
  output?: unknown; // Can be a schema (Zod/Class/String)
  reflection?: {
    params?: (Constructor | Function)[];
    output?: Constructor | Function;
  };
}

/**
 * 🌳 Root storage for a prefix segment (e.g. 'hyper')
 */
export interface HyperPrefixRoot {
  common: HyperCommonMetadata;
  methods: Record<string, HyperMethodMetadata>;
}

/**
 * 🏦 The global metadata store structure per class constructor
 */
export interface HyperMetadataStore {
  server?: HyperPrefixRoot;
  openapi?: unknown;
}

export type HyperApplicationPrivate<T> = T & {
  prepare(): Promise<void>;
};
