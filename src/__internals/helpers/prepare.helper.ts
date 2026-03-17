import "reflect-metadata";
import {
  Request as HE_Request,
  Response as HE_Response,
  Router,
  Server,
} from "hyper-express";
import { container } from "tsyringe";

import { ScopeStore } from "../stores";
import { Metadata } from "../stores/meta.store";
import roleTransform from "../transform/role.transform";
import scopeTransfrom from "../transform/scope.transfrom";
import middlewareTransformer from "../transform/middleware.transform";
import { prepareImports } from "./imports.helper";
import { join } from "../utils/path.util";
import { transformRegistry } from "../transform/transform.registry";

import { MessageBus } from "../../common/message-bus";
import { InternalTransport } from "../../common/transport";

import {
  HyperMetadataStore,
  HyperMethodMetadata,
  HyperPrefixRoot,
  HyperCommonMetadata,
} from "../types";

import { IHyperAppTarget } from "../../type";
import {
  Constructor,
  HyperAppMetadata,
  HyperControllerMetadata,
  HyperModuleMetadata,
  HyperParameterMetadata,
  IHyperHooks,
  ImportType,
  LogSpaces,
  RoleType,
  RouteMetadata,
  ScopeType,
} from "../../lib/server/decorators/types";

interface PrepareTargetParams {
  target: Constructor;
  router?: Router;
  prefix?: string;
  namespace?: string;
  instance: Record<string, any>;
  imports?: ImportType[];
  log: (space: keyof LogSpaces, message: string) => void;
  hooks?: IHyperHooks;
}

interface PrepareTargetReturn {
  router?: Router;
  path?: string;
}

interface PrepareRouteParams {
  target: Constructor;
  router: Router;
  route: RouteMetadata;
  instance: Record<string, any>;
  namespace: string;
  prefix: string;
  scopes?: ScopeType[];
  roles?: RoleType[];
  log: (space: keyof LogSpaces, message: string) => void;
}

interface TargetData {
  app: IHyperAppTarget;
  module: HyperModuleMetadata;
  controller: HyperControllerMetadata;
  middlewares: any[];
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

function getRootMetadata(target: Constructor | Function): HyperMetadataStore {
  return Metadata.get<HyperMetadataStore>(target);
}

function getServerMetadata(target: Constructor | Function): HyperPrefixRoot {
  const root = getRootMetadata(target);

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
    app: common as unknown as IHyperAppTarget,
    module: common as unknown as HyperModuleMetadata,
    controller: common as unknown as HyperControllerMetadata,
    middlewares: middlewareTransformer(common.middlewares ?? []),
    scopes: common.scopes ?? [],
    roles: common.roles ?? [],
    methods: getMethodMetadataMap(target),
    pass: !!common.pass,
  };
}

function logTargetType(
  data: TargetData,
  namespace: string,
  prefix: string | undefined,
  log: (space: keyof LogSpaces, message: string) => void
): void {
  if (data.module) {
    log("modules", `${namespace} { ${prefix || "/"} }`);
    return;
  }

  if (data.controller) {
    log("controllers", `${namespace} { ${prefix || "/"} }`);
  }
}

function shouldCreateRouter(data: TargetData): boolean {
  const modules = data.module?.modules ?? [];
  const controllers = data.module?.controllers ?? [];
  const methods = Object.keys(data.methods).length > 0;

  return (
    modules.length > 0 ||
    controllers.length > 0 ||
    methods ||
    data.middlewares.length > 0 ||
    data.scopes.length > 0 ||
    data.roles.length > 0
  );
}

function resolveTargetRouter(
  router: Router | undefined,
  target: Constructor,
  data: TargetData
): Router | undefined {
  if (router) return router;
  if (!shouldCreateRouter(data)) return undefined;
  return createRouter(target);
}

async function resolveHooks(hooks?: HyperAppMetadata["hooks"]): Promise<IHyperHooks | undefined> {
  if (!hooks) return undefined;

  if (typeof hooks === "function" && !(hooks instanceof Router)) {
    if ("constructor" in hooks && container.isRegistered(hooks)) {
      container.register(hooks, hooks);
    }

    return container.resolve(hooks as any);
  }

  return hooks as IHyperHooks;
}

function configureMessageBus(options: HyperAppMetadata): void {
  const bus = container.resolve(MessageBus);

  if (options?.transports?.length) {
    options.transports.forEach((transport) => bus.registerTransport(transport));
    return;
  }

  bus.registerTransport(container.resolve(InternalTransport));
}

async function prepareTargetImports(
  target: Constructor,
  imports: ImportType[],
  hooks: IHyperHooks | undefined,
  metadata: unknown,
  type: "app" | "target"
): Promise<void> {
  await prepareImports(target, imports, hooks, {
    target,
    metadata,
    type,
  });
}

function applyScopes(
  targetName: string,
  scopes: ScopeType[],
  use: (...args: any[]) => any,
  log?: (space: keyof LogSpaces, message: string) => void
): void {
  scopeTransfrom(scopes, (middleware, resolvedScopes) => {
    ScopeStore.addAll(resolvedScopes);
    use(middleware);

    if (log && scopes.length > 0) {
      log("middleware", `${targetName} with scopes: ${scopes.join(", ")}`);
    }
  });
}

function applyRoles(
  targetName: string,
  roles: RoleType[],
  use: (...args: any[]) => any,
  log?: (space: keyof LogSpaces, message: string) => void
): void {
  roleTransform(roles, (middleware) => {
    use(middleware);

    if (log && roles.length > 0) {
      log("middleware", `${targetName} with roles: ${roles.join(", ")}`);
    }
  });
}

function applyMiddlewares(
  targetName: string,
  middlewares: any[],
  use: (...args: any[]) => any,
  log?: (space: keyof LogSpaces, message: string) => void
): void {
  if (!middlewares.length) return;

  use(...middlewares);

  if (log) {
    log(
      "middleware",
      `${targetName} with middlewares: ${middlewares.map((e) => e.name).join(", ")}`
    );
  }
}

function applyCommonPipeline(
  targetName: string,
  carrier: { use: (...args: any[]) => any },
  data: Pick<TargetData, "middlewares" | "scopes" | "roles">,
  log?: (space: keyof LogSpaces, message: string) => void
): void {
  applyMiddlewares(targetName, data.middlewares, (...args) => carrier.use(...args), log);
  applyScopes(targetName, data.scopes, (...args) => carrier.use(...args), log);
  applyRoles(targetName, data.roles, (...args) => carrier.use(...args), log);
}

/* -------------------------------------------------------------------------- */
/*                           Route/Handler construction                        */
/* -------------------------------------------------------------------------- */

async function resolveMethodParams(
  req: HE_Request,
  res: HE_Response,
  params: HyperParameterMetadata["params"]
): Promise<unknown[]> {
  const len = params.length;
  const args = new Array(len);

  for (let i = 0; i < len; i++) {
    args[i] = await params[i].resolver(req, res);
  }

  return args;
}

function getRouteMethodMeta(target: Constructor, propertyKey: string): HyperMethodMetadata {
  const methods = getMethodMetadataMap(target);
  return methods[propertyKey] || {};
}

function buildRouteMiddlewares(methodMeta: HyperMethodMetadata): any[] {
  const middlewares = middlewareTransformer(methodMeta.middlewares ?? []);
  const scopes = methodMeta.scopes ?? [];
  const roles = methodMeta.roles ?? [];

  roleTransform(roles, (middleware) => middlewares.push(middleware));
  scopeTransfrom(scopes, (middleware, resolvedScopes) => {
    middlewares.push(middleware);
    ScopeStore.addAll(resolvedScopes);
  });

  return middlewares;
}

function getOutputSchema(methodMeta: HyperMethodMetadata): unknown {
  return methodMeta.output || methodMeta.reflection?.output;
}

async function handleResponse(
  req: HE_Request,
  res: HE_Response,
  result: unknown,
  outputSchema: unknown
): Promise<void> {
  if (result === undefined || res.completed) return;

  if (outputSchema && outputSchema !== Object && outputSchema !== Promise) {
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
    return;
  }

  res.send(result as string);
}

function buildErrorResponse(res: HE_Response, err: unknown): void {
  if (res.completed) return;

  const error = err as Error & { status?: number; code?: string };
  console.error(`[ERROR] ${error.message}`, error);

  res.status(error.status || 500).json({
    error: error.message || "Internal Server Error",
    code: error.code,
  });
}

function buildRouteHandler(
  instance: Record<string, any>,
  propertyKey: string,
  params: HyperParameterMetadata["params"],
  outputSchema: unknown
) {
  const handler = instance[propertyKey];

  return async (req: HE_Request, res: HE_Response) => {
    try {
      const args =
        params.length > 0 ? await resolveMethodParams(req, res, params) : [req, res];

      const result = await handler.apply(instance, args);
      await handleResponse(req, res, result, outputSchema);
    } catch (err) {
      buildErrorResponse(res, err);
    }
  };
}

function registerWebSocketRoute(
  router: Router,
  path: string,
  options: unknown,
  handler: Function,
  instance: Record<string, any>
): void {
  router.ws(path, options as any, handler.bind(instance));
}

function registerHttpRoute(
  router: Router,
  method: string,
  path: string,
  middlewares: any[],
  routeHandler: Function
): void {
  const fn = Reflect.get(router, method) as Function | undefined;
  if (!fn) return;

  fn.call(router, path, ...middlewares, routeHandler);
}

async function prepareRoute({
  target,
  router,
  route,
  instance,
  namespace,
  log,
}: PrepareRouteParams): Promise<void> {
  const { method, path, propertyKey, options } = route;
  const handler = instance[propertyKey];

  const methodMeta = getRouteMethodMeta(target, propertyKey);
  const params = methodMeta.params?.params || [];
  const outputSchema = getOutputSchema(methodMeta);
  const middlewares = buildRouteMiddlewares(methodMeta);

  log("routes", `${namespace}/${propertyKey.toString()} ${method.toUpperCase()} { ${path} }`);

  if (method === "ws" && options) {
    registerWebSocketRoute(router, path, options, handler, instance);
    return;
  }

  const routeHandler = buildRouteHandler(instance, propertyKey, params, outputSchema);
  registerHttpRoute(router, method, path, middlewares, routeHandler);
}

async function prepareTargetRoutes(
  target: Constructor,
  router: Router | undefined,
  instance: Record<string, any>,
  namespace: string,
  prefix: string,
  log: (space: keyof LogSpaces, message: string) => void
): Promise<void> {
  if (!router) return;

  const methods = getMethodMetadataMap(target);
  const propertyKeys = Object.keys(methods);

  for (const propertyKey of propertyKeys) {
    const methodMeta = methods[propertyKey];
    const route = methodMeta.route;

    if (!route) continue;

    await prepareRoute({
      target,
      router,
      route,
      namespace,
      instance,
      prefix,
      log,
    });
  }
}

/* -------------------------------------------------------------------------- */
/*                          Child target construction                          */
/* -------------------------------------------------------------------------- */

async function prepareChildModule(
  parentRouter: Router | undefined,
  moduleTarget: Constructor,
  namespace: string,
  log: (space: keyof LogSpaces, message: string) => void,
  hooks?: IHyperHooks
): Promise<void> {
  if (!parentRouter) return;

  const moduleData = getData(moduleTarget);
  if (!moduleData.module) return;

  const result = await prepareTarget({
    target: moduleTarget,
    imports: moduleData.module.imports,
    namespace: `${namespace}/${moduleTarget.name}`,
    prefix: moduleData.module.path,
    instance: container.resolve(moduleTarget),
    log,
    hooks,
  });

  if (result.router) {
    parentRouter.use(result.path || "/", result.router);
  }
}

async function prepareChildController(
  parentRouter: Router | undefined,
  controllerTarget: Constructor,
  namespace: string,
  log: (space: keyof LogSpaces, message: string) => void,
  hooks?: IHyperHooks
): Promise<void> {
  if (!parentRouter) return;

  const controllerData = getData(controllerTarget).controller;
  if (!controllerData) return;

  const result = await prepareTarget({
    target: controllerTarget,
    namespace: `${namespace}/${controllerTarget.name}`,
    prefix: controllerData.path,
    imports: controllerData.imports,
    instance: container.resolve(controllerTarget),
    log,
    hooks,
  });

  if (result.router) {
    parentRouter.use(result.path || "/", result.router);
  }
}

async function prepareChildModules(
  modules: Constructor[],
  router: Router | undefined,
  namespace: string,
  log: (space: keyof LogSpaces, message: string) => void,
  hooks?: IHyperHooks
): Promise<void> {
  for (const module of modules) {
    await prepareChildModule(router, module, namespace, log, hooks);
  }
}

async function prepareChildControllers(
  controllers: Constructor[],
  router: Router | undefined,
  namespace: string,
  log: (space: keyof LogSpaces, message: string) => void,
  hooks?: IHyperHooks
): Promise<void> {
  for (const controller of controllers) {
    await prepareChildController(router, controller, namespace, log, hooks);
  }
}

/* -------------------------------------------------------------------------- */
/*                              Target preparation                             */
/* -------------------------------------------------------------------------- */

async function prepareTarget({
  target,
  router,
  prefix,
  namespace = "",
  instance,
  imports = [],
  log,
  hooks,
}: PrepareTargetParams): Promise<PrepareTargetReturn> {
  const data = getData(target);
  const resolvedRouter = resolveTargetRouter(router, target, data);

  logTargetType(data, namespace, prefix, log);

  await prepareTargetImports(target, imports, hooks, data, "target");

  if (resolvedRouter) {
    applyCommonPipeline(target.name, resolvedRouter, data);
  }

  const modules = data.module?.modules ?? [];
  const controllers = data.module?.controllers ?? [];

  await prepareChildModules(modules, resolvedRouter, namespace, log, hooks);
  await prepareChildControllers(controllers, resolvedRouter, namespace, log, hooks);

  await prepareTargetRoutes(
    target,
    resolvedRouter,
    instance,
    namespace,
    prefix || "/",
    log
  );

  return {
    router: resolvedRouter,
    path: prefix,
  };
}

/* -------------------------------------------------------------------------- */
/*                           Application construction                          */
/* -------------------------------------------------------------------------- */

function createApplicationServer(Target: Constructor): Server {
  const app = new Server();

  if (typeof app.use !== "function") {
    throw new Error(
      `[HyperApp] target instance of ${Target.name} MUST provide .use() method.`
    );
  }

  return app;
}

async function prepareApplicationModules(
  app: Server,
  Target: Constructor,
  options: HyperAppMetadata,
  log: (space: keyof LogSpaces, message: string) => void,
  hooks?: IHyperHooks
): Promise<PrepareTargetReturn[]> {
  const routers: PrepareTargetReturn[] = [];

  for (const module of options.modules) {
    const moduleData = getData(module);
    const path = moduleData.module?.path;

    const result = await prepareTarget({
      target: module,
      router: createRouter(module),
      namespace: `${Target.name}/${module.name}`,
      instance: app as any,
      prefix: path,
      imports: moduleData.module?.imports || [],
      log,
      hooks,
    });

    routers.push(result);
  }

  return routers;
}

function mountApplicationRouters(
  app: Server,
  prefix: string,
  routers: PrepareTargetReturn[]
): void {
  routers
    .filter((entry) => entry.router)
    .forEach(({ router, path }) => {
      app.use(join(prefix, path || "/"), router!);
    });
}

export async function prepareApplication(
  options: HyperAppMetadata,
  Target: Constructor,
  log: (space: keyof LogSpaces, message: string) => void
) {
  const app = createApplicationServer(Target);
  const data = getData(Target);

  const prefix = options.prefix ?? "/";
  const imports = options.imports ?? [];

  configureMessageBus(options);

  const hooks = await resolveHooks(options.hooks);

  await prepareTargetImports(Target, imports, hooks, options, "app");

  applyCommonPipeline(Target.name, app, data, log);

  const routers = await prepareApplicationModules(app, Target, options, log, hooks);
  mountApplicationRouters(app, prefix, routers);

  return app;
}