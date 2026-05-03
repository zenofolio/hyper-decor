import "reflect-metadata";
import {
  Request as HE_Request,
  Response as HE_Response,
  Router,
  Server,
} from "hyper-express";
import { container, injectable } from "tsyringe";

import { ScopeStore } from "../stores";
import { Metadata } from "../stores/meta.store";
import roleTransform from "../transform/role.transform";
import scopeTransfrom from "../transform/scope.transfrom";
import middlewareTransformer from "../transform/middleware.transform";
import { join } from "../utils/path.util";
import { transformRegistry } from "../transform/transform.registry";

import { MessageBus } from "../../common/message-bus";
import { InternalTransport, IMessageTransport, IMessageInterceptor } from "../../common/transport";
import { IIdempotencyStore, InMemoryIdempotencyStore } from "../../common/idempotency";
import { IdempotencyInterceptor } from "../../lib/server/interceptors/IdempotencyInterceptor";

import {
  HyperMethodMetadata,
  HyperPrefixRoot,
  HyperCommonMetadata,
} from "../types";

import {
  Constructor,
  HyperAppMetadata,
  HyperControllerMetadata,
  HyperModuleMetadata,
  HyperParameterMetadata,
  IHyperHooks,
  ImportObject,
  ImportType,
  LogSpaces,
  RoleType,
  RouteMetadata,
  ScopeType,
} from "../../lib/server/decorators/types";

import { isInitialized, setInitialized } from "./lifecycle.helper";

/* -------------------------------------------------------------------------- */
/*                                 Interfaces                                 */
/* -------------------------------------------------------------------------- */

interface ComponentDescriptor<T> {
  target: Constructor;
  instance: object;
  metadata: T;
}

interface MountingContext {
  parentRouter: Router;
  namespace: string;
  prefix: string;
  hooks?: IHyperHooks;
  type: "app" | "module" | "controller" | "service";
  target: Constructor | Function;
}

interface TargetData {
  type: "app" | "module" | "controller" | "service";
  metadata: HyperCommonMetadata;
  middlewares: Function[];
  scopes: ScopeType[];
  roles: RoleType[];
  methods: Record<string, HyperMethodMetadata>;
  pass: boolean;
}

/* -------------------------------------------------------------------------- */
/*                              Bootstrap Context                             */
/* -------------------------------------------------------------------------- */

/**
 * Per-bootstrap weak caches.
 *
 * These caches avoid recalculating metadata, transforming middlewares,
 * and registering handlers repeatedly during a single application bootstrap.
 *
 * They are intentionally scoped to prepareApplication(), so they can be
 * garbage-collected after the bootstrap finishes.
 */
export class BootstrapContext {
  readonly serverMetadataCache = new WeakMap<Function, HyperPrefixRoot>();
  readonly metadataCache = new WeakMap<Function, TargetData>();
  readonly resolvableCache = new WeakSet<Function>();
  readonly handlersCache = new WeakMap<object, Set<string>>();
  readonly importTokenCache = new WeakSet<object | Function>();
}

/**
 * Global single-flight initialization cache.
 *
 * This one is intentionally global. It protects singleton-like objects from
 * being initialized more than once, even if prepareApplication() is called
 * multiple times or if two bootstrap branches try to initialize the same
 * object concurrently.
 */
const globalInitPromises = new WeakMap<object | Function, Promise<void>>();

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function createRouter(target?: Constructor | null): Router {
  if (!target || !(target.prototype instanceof Router)) {
    return new Router();
  }

  return new (target as Constructor<Router>)();
}

function getServerMetadata(
  ctx: BootstrapContext,
  target: Constructor | Function
): HyperPrefixRoot {
  const cached = ctx.serverMetadataCache.get(target);
  if (cached) return cached;

  const root = Metadata.get<any>(target);
  const server =
    root.server ||
    ({
      common: { type: "controller" } as HyperCommonMetadata,
      methods: {},
    } as HyperPrefixRoot);

  ctx.serverMetadataCache.set(target, server);
  return server;
}

function getData(ctx: BootstrapContext, target: Constructor | Function): TargetData {
  const cached = ctx.metadataCache.get(target);
  if (cached) return cached;

  const server = getServerMetadata(ctx, target);
  const common = server.common || ({ type: "controller" } as HyperCommonMetadata);

  const data: TargetData = {
    type: common.type,
    metadata: common,
    middlewares: middlewareTransformer(common.middlewares ?? []),
    scopes: common.scopes ?? [],
    roles: common.roles ?? [],
    methods: (server.methods || {}) as Record<string, HyperMethodMetadata>,
    pass: !!common.pass,
  };

  ctx.metadataCache.set(target, data);
  return data;
}

function getCommonMetadata(
  ctx: BootstrapContext,
  target: Constructor | Function
): HyperCommonMetadata {
  return getData(ctx, target).metadata;
}

function getMethodMetadataMap(
  ctx: BootstrapContext,
  target: Constructor | Function
): Record<string, HyperMethodMetadata> {
  return getData(ctx, target).methods;
}

function logTargetType(
  type: string,
  namespace: string,
  prefix: string,
  log: (space: keyof LogSpaces, message: string) => void
): void {
  if (type === "module") {
    log("modules", `${namespace} { ${prefix} }`);
    return;
  }

  if (type === "controller") {
    log("controllers", `${namespace} { ${prefix} }`);
  }
}

/**
 * Ensures a class is resolvable by tsyringe even without @injectable().
 *
 * Uses a WeakSet to avoid re-applying injectable() and re-checking registration
 * repeatedly during bootstrap.
 */
function ensureResolvable(ctx: BootstrapContext, target: Constructor): void {
  if (ctx.resolvableCache.has(target)) return;

  if (!container.isRegistered(target)) {
    injectable()(target);
    container.register(target, target);
  }

  ctx.resolvableCache.add(target);
}

/**
 * Initializes an object exactly once.
 *
 * This prevents duplicate singleton initialization and also protects against
 * concurrent initialization races by caching the initialization Promise.
 */
async function initOnce(instance: any, token?: object | Function): Promise<void> {
  if (!instance || typeof instance.onInit !== "function") return;

  const key = token ?? instance;
  const existing = globalInitPromises.get(key);

  if (existing) {
    await existing;
    return;
  }

  const promise = Promise.resolve()
    .then(async () => {
      if (isInitialized(instance)) return;

      setInitialized(instance);
      await instance.onInit();
    })
    .catch((error) => {
      globalInitPromises.delete(key);
      throw error;
    });

  globalInitPromises.set(key, promise);
  await promise;
}

/* -------------------------------------------------------------------------- */
/*                              Message Handlers                              */
/* -------------------------------------------------------------------------- */

export async function registerInstanceHandlers(
  ctx: BootstrapContext,
  instance: object,
  target: Constructor,
  namespace: string,
  log: (space: keyof LogSpaces, message: string) => void
): Promise<void> {
  const methods = getMethodMetadataMap(ctx, target);
  const methodKeys = Object.keys(methods);

  if (methodKeys.length === 0) return;

  let registered = ctx.handlersCache.get(instance);

  if (!registered) {
    registered = new Set<string>();
    ctx.handlersCache.set(instance, registered);
  }

  const bus = container.resolve(MessageBus);

  for (const propertyKey of methodKeys) {
    const methodMeta = methods[propertyKey];

    if (!methodMeta.onMessage) continue;

    const cacheKey = `${target.name}:${propertyKey}:${methodMeta.onMessage.topic}`;
    if (registered.has(cacheKey)) continue;

    const handler = (instance as any)[propertyKey];

    if (typeof handler !== "function") {
      throw new Error(
        `Message handler "${target.name}.${String(propertyKey)}" is not a function`
      );
    }

    const { topic, options = {} } = methodMeta.onMessage;

    const finalOptions: Record<string, any> = {
      ...options,
      ...methodMeta,
    };

    delete finalOptions.onMessage;

    await bus.listen(
      topic,
      async (data) => handler.call(instance, data),
      Object.keys(finalOptions).length > 0 ? finalOptions : undefined
    );

    registered.add(cacheKey);
    log("messaging", `${namespace}/${propertyKey} -> ${topic}`);
  }
}

/* -------------------------------------------------------------------------- */
/*                                Middleware                                  */
/* -------------------------------------------------------------------------- */

function applyCommonPipeline(
  targetName: string,
  carrier: { use: (...args: any[]) => any },
  data: Pick<TargetData, "middlewares" | "scopes" | "roles">,
  log?: (space: keyof LogSpaces, message: string) => void
): void {
  if (data.middlewares.length) {
    carrier.use(...data.middlewares);

    log?.(
      "middleware",
      `${targetName} with middlewares: ${data.middlewares
        .map((m) => m.name)
        .join(", ")}`
    );
  }

  if (data.scopes.length) {
    scopeTransfrom(data.scopes, (middleware, resolvedScopes) => {
      ScopeStore.addAll(resolvedScopes);
      carrier.use(middleware);
      log?.("middleware", `${targetName} with scopes: ${data.scopes.join(", ")}`);
    });
  }

  if (data.roles.length) {
    roleTransform(data.roles, (middleware) => {
      carrier.use(middleware);
      log?.("middleware", `${targetName} with roles: ${data.roles.join(", ")}`);
    });
  }
}

/* -------------------------------------------------------------------------- */
/*                           Route/Handler Construction                        */
/* -------------------------------------------------------------------------- */

function buildArgumentsResolver(
  paramsMeta: HyperParameterMetadata["params"]
): (req: HE_Request, res: HE_Response) => Promise<any[]> {
  if (!paramsMeta || paramsMeta.length === 0) {
    return async (req, res) => [req, res];
  }

  const sorted = [...paramsMeta].sort((a, b) => a.index - b.index);
  const hasBody = sorted.some((p) => p.source === "body");

  const resolvers = sorted.map((meta) => {
    if (meta.resolver) return meta.resolver;

    const sourceKey = meta.source;

    if (!sourceKey) {
      return () => null;
    }

    const isWhole = meta.isWholeSource;
    const picker = meta.picker;
    const schema = meta.schema;

    return async (req: HE_Request, res: HE_Response, body: any) => {
      if (sourceKey === "req") return req;
      if (sourceKey === "res") return res;

      const source = sourceKey === "body" ? body : (req as any)[sourceKey];

      if (!source) return null;

      const rawValue = isWhole ? source : picker ? source[picker] : source;

      if (!schema) return rawValue;

      return await transformRegistry.resolve({
        data: rawValue,
        schema,
        options: {},
        req,
        res,
        from: sourceKey as any,
      });
    };
  });

  return async (req: HE_Request, res: HE_Response) => {
    const body =
      hasBody && typeof req.json === "function" ? await req.json() : undefined;

    return await Promise.all(resolvers.map((resolver) => resolver(req, res, body)));
  };
}

function buildResponseSender(
  outputSchema: any
): (res: HE_Response, result: any, req: HE_Request) => Promise<void> {
  const needsTransform =
    outputSchema && outputSchema !== Object && outputSchema !== Promise;

  return async (res: HE_Response, result: any, req: HE_Request) => {
    if (result === undefined || res.headersSent) return;

    if (needsTransform) {
      const transformed = await transformRegistry.resolve({
        data: result,
        schema: outputSchema,
        options: {},
        req,
        res,
        from: "response" as any,
      });

      if (transformed !== undefined && !res.headersSent) {
        res.json(transformed as Record<string, unknown>);
        return;
      }
    }

    if (res.headersSent) return;

    if (typeof result === "object" && result !== null) {
      res.json(result as Record<string, unknown>);
      return;
    }

    res.send(String(result));
  };
}

async function prepareRoute(
  ctx: BootstrapContext,
  target: Constructor,
  router: Router,
  route: RouteMetadata,
  instance: object,
  namespace: string,
  log: (space: keyof LogSpaces, message: string) => void
): Promise<void> {
  const { method, path, propertyKey, options } = route;

  const methodMeta = getMethodMetadataMap(ctx, target)[propertyKey] || {};
  const ctrlMeta = getCommonMetadata(ctx, target);

  log("routes", `${namespace}/${propertyKey} ${method.toUpperCase()} { ${path} }`);

  const handlerMethod = (instance as any)[propertyKey];

  if (typeof handlerMethod !== "function") {
    throw new Error(`Route handler "${target.name}.${String(propertyKey)}" is not a function`);
  }

  if (method === "ws" && options) {
    router.ws(path, options as any, handlerMethod.bind(instance));
    return;
  }

  const middlewares: Function[] = [];

  if (methodMeta.middlewares?.length) {
    middlewares.push(...middlewareTransformer(methodMeta.middlewares));
  }

  const roles =
    ctrlMeta.roles || methodMeta.roles
      ? [...(ctrlMeta.roles ?? []), ...(methodMeta.roles ?? [])]
      : [];

  const scopes =
    ctrlMeta.scopes || methodMeta.scopes
      ? [...(ctrlMeta.scopes ?? []), ...(methodMeta.scopes ?? [])]
      : [];

  if (roles.length) {
    roleTransform(roles, (middleware) => {
      middlewares.push(middleware);
    });
  }

  if (scopes.length) {
    scopeTransfrom(scopes, (middleware, resolvedScopes) => {
      middlewares.push(middleware);
      ScopeStore.addAll(resolvedScopes);
    });
  }

  const argumentResolver = buildArgumentsResolver(methodMeta.params?.params || []);
  const responseSender = buildResponseSender(
    methodMeta.output || methodMeta.reflection?.output
  );

  const handler = async (req: HE_Request, res: HE_Response) => {
    try {
      const args = await argumentResolver(req, res);
      const result = await handlerMethod.apply(instance, args);

      await responseSender(res, result, req);
    } catch (err) {
      if (res.headersSent) return;

      const error = err as any;

      res.status(error.status || 500).json({
        error: error.message || "Internal Server Error",
        code: error.code || "InternalServerError",
      });
    }
  };

  const mount = Reflect.get(router, method) as Function;

  if (typeof mount !== "function") {
    throw new Error(`Unsupported route method "${String(method)}"`);
  }

  mount.call(router, path, ...middlewares, handler);
}

/* -------------------------------------------------------------------------- */
/*                              Preparation Logic                             */
/* -------------------------------------------------------------------------- */

async function prepareImportsInternal(
  ctx: BootstrapContext,
  imports: ImportType[],
  context: MountingContext,
  log: (space: keyof LogSpaces, message: string) => void
): Promise<void> {
  if (!imports.length) return;

  for (const item of imports) {
    let token: any;

    if (typeof item === "function") {
      token = item;

      if (!container.isRegistered(token)) {
        ensureResolvable(ctx, token as Constructor);
      }
    } else if (typeof item === "object" && item !== null) {
      const obj = item as ImportObject;
      token = obj.token;

      if (!ctx.importTokenCache.has(token)) {
        if (obj.useClass) {
          container.register(token, { useClass: obj.useClass });
        } else if (obj.useValue) {
          container.register(token, { useValue: obj.useValue } as any);
        } else if (obj.useFactory) {
          container.register(token, { useFactory: obj.useFactory } as any);
        } else if (obj.useToken) {
          container.register(token, { useToken: obj.useToken } as any);
        }

        ctx.importTokenCache.add(token);
      }
    } else {
      token = item as any;
    }

    const instance = container.resolve(token) as any;

    if (!instance) continue;

    const itemContext: MountingContext = {
      ...context,
      type: "service",
      target: token,
    };

    await context.hooks?.onBeforeInit?.(instance, token, itemContext);

    if (typeof token === "function" && token.name) {
      await registerInstanceHandlers(
        ctx,
        instance,
        token as Constructor,
        `imports/${token.name}`,
        log
      );
    }

    await initOnce(instance, token);

    await context.hooks?.onAfterInit?.(instance, token, itemContext);
  }
}

async function registerRoutes(
  ctx: BootstrapContext,
  target: Constructor,
  instance: object,
  router: Router | Server,
  namespace: string,
  log: (space: keyof LogSpaces, message: string) => void
): Promise<void> {
  const methods = getMethodMetadataMap(ctx, target);

  for (const key of Object.keys(methods)) {
    const route = methods[key].route;

    if (route) {
      await prepareRoute(ctx, target, router as Router, route, instance, namespace, log);
    }
  }
}

async function prepareController(
  ctx: BootstrapContext,
  descriptor: ComponentDescriptor<HyperControllerMetadata>,
  context: MountingContext,
  log: (space: keyof LogSpaces, message: string) => void
): Promise<void> {
  const { target, instance, metadata } = descriptor;

  const data = getData(ctx, target);
  const router = createRouter();

  logTargetType("controller", context.namespace, context.prefix, log);

  await prepareImportsInternal(ctx, metadata.imports ?? [], context, log);

  await registerInstanceHandlers(ctx, instance, target, context.namespace, log);

  applyCommonPipeline(
    target.name,
    { use: (...args) => router.use(...args) },
    data,
    log
  );

  await registerRoutes(ctx, target, instance, router, context.namespace, log);

  context.parentRouter.use(context.prefix, router);
}

async function prepareModule(
  ctx: BootstrapContext,
  descriptor: ComponentDescriptor<HyperModuleMetadata>,
  context: MountingContext,
  log: (space: keyof LogSpaces, message: string) => void
): Promise<void> {
  const { target, instance, metadata } = descriptor;

  const data = getData(ctx, target);
  const router = createRouter();

  logTargetType("module", context.namespace, context.prefix, log);

  await prepareImportsInternal(ctx, metadata.imports ?? [], context, log);

  await registerInstanceHandlers(ctx, instance, target, context.namespace, log);

  applyCommonPipeline(
    target.name,
    { use: (...args) => router.use(...args) },
    data,
    log
  );

  if (metadata.modules?.length) {
    for (const moduleTarget of metadata.modules) {
      const moduleData = getData(ctx, moduleTarget).metadata as HyperModuleMetadata;

      ensureResolvable(ctx, moduleTarget);

      await prepareModule(
        ctx,
        {
          target: moduleTarget,
          instance: container.resolve(moduleTarget),
          metadata: moduleData,
        },
        {
          parentRouter: router,
          namespace: `${context.namespace}/${moduleTarget.name}`,
          prefix: moduleData.path || "/",
          hooks: context.hooks,
          type: "module",
          target: moduleTarget,
        },
        log
      );
    }
  }

  await registerRoutes(ctx, target, instance, router, context.namespace, log);

  if (metadata.controllers?.length) {
    for (const controllerTarget of metadata.controllers) {
      const controllerData = getData(
        ctx,
        controllerTarget
      ).metadata as HyperControllerMetadata;

      ensureResolvable(ctx, controllerTarget);

      await prepareController(
        ctx,
        {
          target: controllerTarget,
          instance: container.resolve(controllerTarget),
          metadata: controllerData,
        },
        {
          parentRouter: router,
          namespace: `${context.namespace}/${controllerTarget.name}`,
          prefix: controllerData.path || "/",
          hooks: context.hooks,
          type: "controller",
          target: controllerTarget,
        },
        log
      );
    }
  }

  context.parentRouter.use(context.prefix, router);
}

/* -------------------------------------------------------------------------- */
/*                              Application Boot                              */
/* -------------------------------------------------------------------------- */

export async function prepareApplication(
  options: HyperAppMetadata,
  Target: Constructor,
  log: (space: keyof LogSpaces, message: string) => void
): Promise<Server> {
  const ctx = new BootstrapContext();

  const appServer = new Server(options.uwsOptions || options.options);

  appServer.set_error_handler((req, res, error) => {
    if (res.headersSent) return;

    const status = (error as any).status || 500;

    res.status(status).json({
      error: error.message || "Internal Server Error",
      code: (error as any).code || "InternalServerError",
      ...(process.env.NODE_ENV !== "production" && error instanceof Error
        ? { stack: error.stack }
        : {}),
    });
  });

  ensureResolvable(ctx, Target);

  const appInstance = container.resolve(Target);
  const data = getData(ctx, Target);
  const metadata = data.metadata as HyperAppMetadata;

  // --- 2.5 Message Interceptors & Idempotency ---
  const { interceptor, idempotency } = metadata;
  const bus = container.resolve(MessageBus);

  // Always register config to avoid injection errors
  container.register("IdempotencyConfig", { useValue: idempotency || { enabled: false } });
  if (!container.isRegistered("RedisClient")) {
    container.register("RedisClient", { useValue: null });
  }

  // Register Idempotency Store if enabled or if custom store provided
  if (idempotency?.enabled !== false) {
    const storeToken = "IIdempotencyStore";

    if (!container.isRegistered(storeToken)) {
      const StoreClass = idempotency?.store || InMemoryIdempotencyStore;

      if (typeof StoreClass === "function") {
        container.register(storeToken, { useClass: StoreClass as Constructor<IIdempotencyStore> });
      } else {
        container.register(storeToken, { useValue: StoreClass });
      }
    }

    // Initialize the store
    const store = container.resolve<IIdempotencyStore>(storeToken);
    if (store.onInit) {
      await store.onInit();
    }

    // Default to IdempotencyInterceptor if no custom interceptor provided
    if (!interceptor) {
      bus.setInterceptor(container.resolve(IdempotencyInterceptor));
    }
  }

  // Set custom interceptor if provided
  if (interceptor) {
    const resolvedInterceptor = typeof interceptor === "function"
      ? container.resolve(interceptor as Constructor<IMessageInterceptor>)
      : interceptor;
    bus.setInterceptor(resolvedInterceptor);
  }

  // --- 3. Transport Preparation ---
  const transports = metadata.transports && metadata.transports.length > 0
    ? metadata.transports
    : options.transports && options.transports.length > 0
      ? options.transports
      : [InternalTransport];

  for (const transport of transports as IMessageTransport[]) {
    bus.registerTransport(typeof transport === "function" ? container.resolve(transport) : transport);
    await initOnce(transport, transport);
  }

  const hooks = options.hooks
    ? typeof options.hooks === "function"
      ? container.resolve(options.hooks as any)
      : options.hooks
    : undefined;

  const context: MountingContext = {
    parentRouter: appServer as any,
    namespace: Target.name,
    prefix: options.prefix ?? "/",
    hooks: hooks as any,
    type: "app",
    target: Target,
  };

  await prepareImportsInternal(ctx, options.imports ?? [], context, log);

  await registerInstanceHandlers(ctx, appInstance, Target, context.namespace, log);

  applyCommonPipeline(
    Target.name,
    { use: (...args) => appServer.use(...args) },
    data,
    log
  );

  await registerRoutes(ctx, Target, appInstance, appServer, context.namespace, log);

  if (options.modules?.length) {
    for (const moduleTarget of options.modules) {
      const moduleData = getData(ctx, moduleTarget).metadata as HyperModuleMetadata;

      ensureResolvable(ctx, moduleTarget);

      await prepareModule(
        ctx,
        {
          target: moduleTarget,
          instance: container.resolve(moduleTarget),
          metadata: moduleData,
        },
        {
          parentRouter: appServer as any,
          namespace: `${Target.name}/${moduleTarget.name}`,
          prefix: join(context.prefix, moduleData.path || "/"),
          hooks: hooks as any,
          type: "module",
          target: moduleTarget,
        },
        log
      );
    }
  }

  await initOnce(appInstance, Target);

  return appServer;
}
