import "reflect-metadata";
import {
  Request as HE_Request,
  Response as HE_Response,
  Router,
  Server,
} from "hyper-express";
import { container, InjectionToken, injectable } from "tsyringe";

import { ScopeStore } from "../stores";
import { Metadata } from "../stores/meta.store";
import roleTransform from "../transform/role.transform";
import scopeTransfrom from "../transform/scope.transfrom";
import middlewareTransformer from "../transform/middleware.transform";
import { join } from "../utils/path.util";
import { transformRegistry } from "../transform/transform.registry";

import { MessageBus } from "../../common/message-bus";
import { InternalTransport } from "../../common/transport";

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
  OnInit,
  ParameterResolver,
  RoleType,
  RouteMetadata,
  ScopeType,
} from "../../lib/server/decorators/types";

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
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function createRouter(target?: Constructor | null): Router {
  if (!target || !(target.prototype instanceof Router)) {
    return new Router();
  }
  return new (target as Constructor<Router>)();
}

function getServerMetadata(target: Constructor | Function): HyperPrefixRoot {
  const root = Metadata.get<any>(target);
  return root.server || {
    common: { type: "controller" } as HyperCommonMetadata,
    methods: {},
  };
}

function getCommonMetadata(target: Constructor | Function): HyperCommonMetadata {
  const server = getServerMetadata(target);
  return server.common || ({ type: "controller" } as HyperCommonMetadata);
}

function getMethodMetadataMap(
  target: Constructor | Function
): Record<string, HyperMethodMetadata> {
  const server = getServerMetadata(target);
  return (server.methods || {}) as Record<string, HyperMethodMetadata>;
}

function getData(target: Constructor | Function): TargetData {
  const common = getCommonMetadata(target);
  return {
    type: common.type,
    metadata: common,
    middlewares: middlewareTransformer(common.middlewares ?? []),
    scopes: common.scopes ?? [],
    roles: common.roles ?? [],
    methods: getMethodMetadataMap(target),
    pass: !!common.pass,
  };
}

function logTargetType(
  type: string,
  namespace: string,
  prefix: string,
  log: (space: keyof LogSpaces, message: string) => void
): void {
  if (type === "module") {
    log("modules", `${namespace} { ${prefix} }`);
  } else if (type === "controller") {
    log("controllers", `${namespace} { ${prefix} }`);
  }
}

export async function registerInstanceHandlers(
  instance: object,
  target: Constructor,
  namespace: string,
  log: (space: keyof LogSpaces, message: string) => void
): Promise<void> {
  const methods = getMethodMetadataMap(target);
  const bus = container.resolve(MessageBus);

  for (const propertyKey of Object.keys(methods)) {
    const methodMeta = methods[propertyKey];
    if (methodMeta.onMessage) {
      await bus.listen(methodMeta.onMessage.topic, async (data) => {
        return await (instance as any)[propertyKey].call(instance, data);
      });
      log("messaging", `${namespace}/${propertyKey} -> ${methodMeta.onMessage.topic}`);
    }
  }
}

function applyCommonPipeline(
  targetName: string,
  carrier: { use: (...args: any[]) => any },
  data: Pick<TargetData, "middlewares" | "scopes" | "roles">,
  log?: (space: keyof LogSpaces, message: string) => void
): void {
  if (data.middlewares.length) {
    carrier.use(...data.middlewares);
    log?.("middleware", `${targetName} with middlewares: ${data.middlewares.map(m => m.name).join(", ")}`);
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
/*                           Route/Handler construction                        */
/* -------------------------------------------------------------------------- */

function buildArgumentsResolver(
  paramsMeta: HyperParameterMetadata["params"]
): (req: HE_Request, res: HE_Response) => Promise<any[]> {
  const sorted = [...paramsMeta].sort((a, b) => a.index - b.index);
  const hasBody = sorted.some((p) => p.source === "body");

  // Pre-calculate per-parameter resolution logic
  const resolvers = sorted.map((meta) => {
    if (meta.resolver) return meta.resolver;

    const sourceKey = meta.source;
    if (!sourceKey) return () => null;

    const isWhole = meta.isWholeSource;
    const picker = meta.picker;
    const schema = meta.schema;

    return async (req: HE_Request, res: HE_Response, body: any) => {
      if (sourceKey === "req") return req;
      if (sourceKey === "res") return res;

      let source = sourceKey === "body" ? body : (req as any)[sourceKey];
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
    if (resolvers.length === 0) return [req, res];

    const body = hasBody && typeof req.json === "function" ? await req.json() : undefined;
    return await Promise.all(resolvers.map((r) => r(req, res, body)));
  };
}

function buildResponseSender(
  outputSchema: any
): (res: HE_Response, result: any, req: HE_Request) => Promise<void> {
  const needsTransform =
    outputSchema && outputSchema !== Object && outputSchema !== Promise;

  return async (res: HE_Response, result: any, req: HE_Request) => {
    if (result === undefined || res.completed) return;

    if (needsTransform) {
      const transformed = await transformRegistry.resolve({
        data: result,
        schema: outputSchema,
        options: {},
        req,
        res,
        from: "response" as any,
      });
      if (transformed !== undefined && !res.completed) {
        res.json(transformed as Record<string, unknown>);
        return;
      }
    }

    if (res.completed) return;
    if (typeof result === "object" && result !== null) {
      res.json(result as Record<string, unknown>);
    } else {
      res.send(result as string);
    }
  };
}

async function prepareRoute(
  target: Constructor,
  router: Router,
  route: RouteMetadata,
  instance: object,
  namespace: string,
  log: (space: keyof LogSpaces, message: string) => void
): Promise<void> {
  const { method, path, propertyKey, options } = route;
  const methodMeta = getMethodMetadataMap(target)[propertyKey] || {};
  const ctrlMeta = getCommonMetadata(target);

  const roles = [...(ctrlMeta.roles ?? []), ...(methodMeta.roles ?? [])];
  const scopes = [...(ctrlMeta.scopes ?? []), ...(methodMeta.scopes ?? [])];

  const middlewares = middlewareTransformer(methodMeta.middlewares ?? []);
  roleTransform(roles, m => middlewares.push(m));
  scopeTransfrom(scopes, (m, s) => {
    middlewares.push(m);
    ScopeStore.addAll(s);
  });

  log("routes", `${namespace}/${propertyKey} ${method.toUpperCase()} { ${path} }`);

  if (method === "ws" && options) {
    router.ws(path, options as any, (instance as any)[propertyKey].bind(instance));
    return;
  }

  const argumentResolver = buildArgumentsResolver(methodMeta.params?.params || []);
  const responseSender = buildResponseSender(
    methodMeta.output || methodMeta.reflection?.output
  );
  const handlerMethod = (instance as any)[propertyKey];

  const handler = async (req: HE_Request, res: HE_Response) => {
    try {
      const args = await argumentResolver(req, res);
      const result = await handlerMethod.apply(instance, args);
      await responseSender(res, result, req);
    } catch (err) {
      if (res.completed) return;
      const error = err as any;
      res.status(error.status || 500).json({
        error: error.message || "Internal Server Error",
        code: error.code,
      });
    }
  };

  const fn = Reflect.get(router, method) as Function;
  if (fn) fn.call(router, path, ...middlewares, handler);
}

/* -------------------------------------------------------------------------- */
/*                              Preparation Logic                             */
/* -------------------------------------------------------------------------- */

async function prepareImportsInternal(
  imports: ImportType[],
  context: MountingContext,
  log: (space: keyof LogSpaces, message: string) => void
): Promise<void> {
  await Promise.all(imports.map(async (item) => {
    let token: InjectionToken;
    if (typeof item === "function") {
      token = item;
      if (!container.isRegistered(token)) container.register(token, token as Constructor);
    } else if (typeof item === "object" && item !== null) {
      const obj = item as ImportObject;
      token = obj.token;
      if (obj.useClass) container.register(token, { useClass: obj.useClass });
      else if (obj.useValue) container.register(token, { useValue: obj.useValue } as any);
      else if (obj.useFactory) container.register(token, { useFactory: obj.useFactory } as any);
      else if (obj.useToken) container.register(token, { useToken: obj.useToken } as any);
    } else {
      token = item as InjectionToken;
    }

    const instance = container.resolve(token) as any;
    if (instance) {
      const itemContext = { ...context, type: "service" as const, target: token };
      if (context.hooks?.onBeforeInit) await context.hooks.onBeforeInit(instance, token, itemContext);
      if (typeof token === "function" && token.name) {
        await registerInstanceHandlers(instance, token as Constructor, `imports/${token.name}`, log);
      }
      if (typeof instance.onInit === "function") await instance.onInit();
      if (context.hooks?.onAfterInit) await context.hooks.onAfterInit(instance, token, itemContext);
    }
  }));
}

/**
 * Ensures a class is resolvable by tsyringe even without @injectable()
 */
function ensureResolvable(target: Constructor) {
  if (!container.isRegistered(target)) {
    // We apply injectable() at runtime to ensure metadata is picked up if not already done
    injectable()(target);
    container.register(target, target);
  }
}

async function prepareController(
  descriptor: ComponentDescriptor<HyperControllerMetadata>,
  context: MountingContext,
  log: (space: keyof LogSpaces, message: string) => void
): Promise<void> {
  const { target, instance, metadata } = descriptor;
  const data = getData(target);
  const router = new Router();

  logTargetType("controller", context.namespace, context.prefix, log);

  await prepareImportsInternal(metadata.imports ?? [], context, log);
  await registerInstanceHandlers(instance, target, context.namespace, log);
  
  applyCommonPipeline(target.name, { use: (...args) => router.use(...args) }, data, log);

  const methods = getMethodMetadataMap(target);
  for (const key of Object.keys(methods)) {
    const route = methods[key].route;
    if (route) await prepareRoute(target, router, route, instance, context.namespace, log);
  }

  context.parentRouter.use(context.prefix, router);
}

async function prepareModule(
  descriptor: ComponentDescriptor<HyperModuleMetadata>,
  context: MountingContext,
  log: (space: keyof LogSpaces, message: string) => void
): Promise<void> {
  const { target, instance, metadata } = descriptor;
  const data = getData(target);
  const router = new Router();

  logTargetType("module", context.namespace, context.prefix, log);

  await prepareImportsInternal(metadata.imports ?? [], context, log);
  await registerInstanceHandlers(instance, target, context.namespace, log);

  applyCommonPipeline(target.name, { use: (...args) => router.use(...args) }, data, log);

  // Recurse modules
  if (metadata.modules?.length) {
    for (const m of metadata.modules) {
      const mData = getData(m).metadata as HyperModuleMetadata;
      ensureResolvable(m);
      await prepareModule(
        { target: m, instance: container.resolve(m), metadata: mData },
        { 
          parentRouter: router, 
          namespace: `${context.namespace}/${m.name}`, 
          prefix: mData.path || "/", 
          hooks: context.hooks,
          type: "module",
          target: m
        },
        log
      );
    }
  }

  // Direct routes on module
  const methods = getMethodMetadataMap(target);
  for (const key of Object.keys(methods)) {
    const route = methods[key].route;
    if (route) await prepareRoute(target, router, route, instance, context.namespace, log);
  }

  // Controllers
  if (metadata.controllers?.length) {
    for (const c of metadata.controllers) {
      const cData = getData(c).metadata as HyperControllerMetadata;
      ensureResolvable(c);
      await prepareController(
        { target: c, instance: container.resolve(c), metadata: cData },
        { 
          parentRouter: router, 
          namespace: `${context.namespace}/${c.name}`, 
          prefix: cData.path || "/", 
          hooks: context.hooks,
          type: "controller",
          target: c
        },
        log
      );
    }
  }

  context.parentRouter.use(context.prefix, router);
}

export async function prepareApplication(
  options: HyperAppMetadata,
  Target: Constructor,
  log: (space: keyof LogSpaces, message: string) => void
): Promise<Server> {
  const appServer = new Server(options.uwsOptions || options.options);
  
  // Register global error handler to properly handle status codes from exceptions
  appServer.set_error_handler((req, res, error) => {
    const status = (error as any).status || 500;
    res.status(status).json({
      error: error.message || "Internal Server Error",
      code: (error as any).code || "InternalServerError",
      ...(error instanceof Error ? { stack: error.stack } : {})
    });
  });

  ensureResolvable(Target);
  const appInstance = container.resolve(Target);
  const data = getData(Target);

  const bus = container.resolve(MessageBus);
  const transports = options.transports && options.transports.length > 0 ? options.transports : [InternalTransport];
  transports.forEach(t => bus.registerTransport(typeof t === "function" ? container.resolve(t as any) : t));

  const hooks = (options.hooks ? (typeof options.hooks === "function" ? container.resolve(options.hooks as any) : options.hooks) : undefined) as any;
  const context: MountingContext = { 
    parentRouter: appServer as any, 
    namespace: Target.name, 
    prefix: options.prefix ?? "/", 
    hooks,
    type: "app",
    target: Target
  };

  await prepareImportsInternal(options.imports ?? [], context, log);
  await registerInstanceHandlers(appInstance, Target, context.namespace, log);
  
  applyCommonPipeline(Target.name, { use: (...args) => appServer.use(...args) }, data, log);

  // Direct routes on app
  const methods = getMethodMetadataMap(Target);
  for (const key of Object.keys(methods)) {
    const route = methods[key].route;
    if (route) await prepareRoute(Target, appServer as any, route, appInstance, context.namespace, log);
  }

  if (options.modules?.length) {
    for (const m of options.modules) {
      const mData = getData(m).metadata as HyperModuleMetadata;
      ensureResolvable(m);
      await prepareModule(
        { target: m, instance: container.resolve(m), metadata: mData },
        { 
          parentRouter: appServer as any, 
          namespace: `${Target.name}/${m.name}`, 
          prefix: join(context.prefix, mData.path || "/"), 
          hooks,
          type: "module",
          target: m
        },
        log
      );
    }
  }

  return appServer;
}