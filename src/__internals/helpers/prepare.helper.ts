import {
  MiddlewareHandler,
  Request as HE_Request,
  Response as HE_Response,
  Router,
  Server,
} from "hyper-express";

import { ScopeStore } from "../../stores";
import roleTransform from "../transform/role.transform";
import scopeTransfrom from "../transform/scope.transfrom";
import { $each } from "../utils/object.util";
import { getDecorData } from "../decorator-base";
import { IHyperAppTarget } from "../../type";
import {
  HyperAppMetadata,
  HyperControllerMetadata,
  IHyperHooks,
  HyperModuleMetadata,
  HyperParameterMetadata,
  ImportType,
  LogSpaces,
  OnInit,
  RoleType,
  RouteMetadata,
  ScopeType,
} from "../../decorators/types";
import {
  KEY_PARAMS_APP,
  KEY_PARAMS_MIDDLEWARES,
  KEY_PARAMS_MODULE,
  KEY_PARAMS_PARAM,
  KEY_PARAMS_PASS,
  KEY_PARAMS_ROLE,
  KEY_PARAMS_ROUTE,
  KEY_PARAMS_SCOPE,
  KEY_TYPE_CONTROLLER,
  KEY_OUTPUT_SCHEMA,
  DESIGN_RETURNTYPE,
} from "../constants";

import middlewareTransformer from "../transform/middleware.transform";
import { container } from "tsyringe";
import { RouterList } from "../types";
import { join } from "../utils/path.util";
import { prepareImports } from "./imports.helper";
import { initializeInstance } from "./lifecycle.helper";
import { MessageBus } from "../../common/message-bus";
import { InternalTransport } from "../../common/transport";
import { transformRegistry } from "../transform/transform.registry";

interface PrepareTargetParams {
  target: any;
  router?: Router;
  prefix?: string;
  namespace?: string;
  instance?: any;
  imports?: ImportType[];
  log: (space: keyof LogSpaces, message: string) => void;
}

interface PrepareTargetReturn {
  router?: Router;
  path?: string;
}

interface PrepareRouteParams {
  target: any;
  router: Router;
  route: RouteMetadata;
  instance: any;
  namespace: string;
  prefix: string;
  scopes?: ScopeType[];
  roles?: RoleType[];
  log: (space: keyof LogSpaces, message: string) => void;
}

const if_router = (current?: any | null): Router => {
  if (!current || !(current?.prototype instanceof Router)) return new Router();
  return new current();
};

/**
 * Extract the data from the target class.
 *
 * @param target
 * @returns
 */
function getData(target: any) {
  const app = getDecorData<IHyperAppTarget>(KEY_PARAMS_APP, target);
  const module = getDecorData<HyperModuleMetadata>(KEY_PARAMS_MODULE, target);
  const controller = getDecorData<HyperControllerMetadata>(
    KEY_TYPE_CONTROLLER,
    target
  );

  const middlewares = middlewareTransformer(
    getDecorData<MiddlewareHandler[]>(KEY_PARAMS_MIDDLEWARES, target) ?? []
  );
  const scopes = getDecorData<ScopeType[]>(KEY_PARAMS_SCOPE, target) ?? [];
  const roles = getDecorData<RoleType[]>(KEY_PARAMS_ROLE, target) ?? [];
  const routes = getDecorData<RouterList>(KEY_PARAMS_ROUTE, target) ?? {
    routes: [],
  };

  const params =
    getDecorData<HyperParameterMetadata>(KEY_PARAMS_PARAM, target) ?? {};
  const pass = getDecorData<HyperParameterMetadata>(KEY_PARAMS_PASS, target);

  return {
    app,
    module,
    controller,
    middlewares,
    scopes,
    roles,
    routes,
    params,
    pass,
  };
}

/**
 * Prepare the application with the given options.
 *
 * @param options
 * @param Target
 * @param app
 * @param log
 */
export async function prepareApplication(
  options: HyperAppMetadata,
  Target: any,
  app: Server,
  log: (space: keyof LogSpaces, message: string) => void
) {
  const data = getData(Target);
  const prefix = options.prefix ?? "/";
  const imports = options.imports ?? [];

  // Register transports if provided, otherwise fallback to internal
  const bus = container.resolve(MessageBus);
  if (options?.transports?.length) {
    options.transports.forEach((t) => bus.registerTransport(t));
  } else {
    bus.registerTransport(new InternalTransport());
  }

  let hooks = options.hooks;
  if (typeof hooks === "function" && !(hooks instanceof Router)) {
    if (hooks && "constructor" in hooks) {
      if (container.isRegistered(hooks)) {
        container.register(hooks, hooks);
      }
    }

    hooks = container.resolve(hooks as any);
  }

  const context = { target: Target, metadata: options, type: "app" };
  await prepareImports(Target, imports, hooks as IHyperHooks, context);

  if (data.middlewares.length) {
    app.use(...data.middlewares);
    log(
      "middleware",
      `${Target.name} with middlewares: ${data.middlewares
        .map((e) => e.name)
        .join(", ")}`
    );
  }

  scopeTransfrom(data.scopes, (middleware, scopes) => {
    ScopeStore.addAll(scopes);
    app.use(middleware);
    log("middleware", `${Target.name} with scopes: ${data.scopes.join(", ")}`);
  });

  roleTransform(data.roles, (middleware) => {
    app.use(middleware);
    log("middleware", `${Target.name} with roles: ${data.roles.join(", ")}`);
  });

  const routers = (await Promise.all(
    options.modules.map(async (module) => {
      const data = getData(module);
      const path = data.module?.path;
      const imports = data.module?.imports ?? [];
      return prepareTarget({
        target: module,
        router: if_router(module),
        namespace: `${Target.name}/${module.name}`,
        instance: app,
        prefix: path,
        imports: imports,
        log,
        hooks: hooks as IHyperHooks,
      });
    })
  )).filter((r) => r.router);

  routers.forEach(({ router, path }) => {
    app.use(join(prefix, path || "/"), router!);
  });
}

/**
 * Prepare the target class
 * HyperModule or HyperController can be used as target.
 *
 * @param param0
 * @returns
 */
async function prepareTarget({
  target,
  router,
  prefix,
  namespace = "",
  instance,
  imports = [],
  log,
  hooks,
}: PrepareTargetParams & { hooks?: IHyperHooks }): Promise<PrepareTargetReturn> {
  const data = getData(target);

  if (data.module) {
    log("modules", `${namespace} { ${prefix || "/"} }`);
  } else if (data.controller) {
    log("controllers", `${namespace} { ${prefix || "/"} }`);
  }

  const modules = data.module?.modules ?? [];
  const controllers = data.module?.controllers ?? [];
  const routes = data.routes ?? { routes: [] };

  const middlewares = data.middlewares ?? [];
  const scopes = data.scopes ?? [];
  const roles = data.roles ?? [];

  const needsRouter =
    controllers.length > 0 ||
    routes.routes.size > 0 ||
    middlewares.length > 0 ||
    scopes.length > 0 ||
    roles.length > 0;

  const _router = router ?? (needsRouter ? if_router(target) : undefined);

  ////////////////////////////////
  /// Prepare Imports
  ////////////////////////////////

  const context = { target: target, metadata: data, type: "target" };
  await prepareImports(target, imports, hooks, context);

  ////////////////////////////////
  /// Attach Middlewares & Security
  ////////////////////////////////

  if (_router) {
    _router.use(...middlewares);

    scopeTransfrom(scopes, (middleware, scopes) => {
      ScopeStore.addAll(scopes);
      _router.use(middleware);
    });

    roleTransform(roles, (middleware) => _router.use(middleware));
  }

  ////////////////////////////////
  /// Prepare Modules
  ////////////////////////////////

  await $each(modules, async (module) => {
    const moduleData = getData(module);
    if (!moduleData.module) return;

    const res = await prepareTarget({
      target: module,
      imports: moduleData.module.imports,
      namespace: `${namespace}/${module.name}`,
      prefix: moduleData.module.path,
      instance: container.resolve(module),
      log,
      hooks,
    });

    if (res.router && _router) {
      _router.use(res.path || "/", res.router);
    }
  });

  // ////////////////////////////////
  // /// Prepare Controllers
  // ////////////////////////////////

  await $each(controllers, async (controller) => {
    const data = getData(controller);
    const controllerData = data.controller;
    if (!controllerData) return;

    const res = await prepareTarget({
      target: controller,
      namespace: `${namespace}/${controller.name}`,
      prefix: controllerData.path,
      imports: controllerData.imports,
      instance: container.resolve(controller),
      log,
      hooks,
    });

    if (res.router && _router) {
      _router.use(res.path || "/", res.router);
    }
  });

  ////////////////////////////////
  /// Prepare Routes
  ////////////////////////////////

  if (_router) {
    await $each(Array.from(routes.routes), async (route) => {
      if (typeof route !== "object") return;
      await prepareRoutes({
        target: target,
        router: _router,
        route,
        namespace,
        instance,
        prefix: prefix || "/",
        log,
      });
    });
  }

  return {
    router: _router,
    path: prefix,
  };
}

/**
 * Resolves method parameters and applies adaptive transformations.
 * Optimized: Metadata is resolved once and passed here.
 */
async function resolveMethodParams(
  req: HE_Request,
  res: HE_Response,
  params: any[]
): Promise<any[]> {
  const len = params.length;
  const args = new Array(len);

  for (let i = 0; i < len; i++) {
    args[i] = await params[i].resolver(req, res);
  }
  return args;
}

/**
 * Handles output transformation and sends the response.
 * Optimized: outputSchema is pre-resolved outside the request hotpath.
 */
async function handleResponse(
  req: HE_Request,
  res: HE_Response,
  result: any,
  outputSchema: any
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
      res.json(transformed);
      return;
    }
  }

  if (!res.completed) {
    if (typeof result === "object" && result !== null) {
      res.json(result);
    } else {
      res.send(result);
    }
  }
}


/**
 * Prepare the routes for the target class.
 */
async function prepareRoutes({
  target,
  router,
  route,
  instance,
  namespace,
  log,
}: PrepareRouteParams) {
  const { method, path, handler, propertyKey, options } = route;
  const metadata = getData(handler);
  const params = metadata.params?.params?.[propertyKey] ?? [];
  const $fn = Reflect.get(router, method);

  if (!$fn) return;

  const middlewares = [...metadata.middlewares];

  const proto = target.prototype || target;


  // Pre-resolve Output-Metadata
  const outputSchema =
    Reflect.getMetadata(KEY_OUTPUT_SCHEMA, proto, propertyKey) ||
    Reflect.getMetadata(DESIGN_RETURNTYPE, proto, propertyKey);

  roleTransform(metadata.roles, (middleware) => middlewares.push(middleware));
  scopeTransfrom(metadata.scopes, (middleware, scopes) => {
    middlewares.push(middleware);
    ScopeStore.addAll(scopes);
  });

  log(
    "routes",
    `${namespace}/${propertyKey.toString()} ${method.toUpperCase()} { ${path} }`
  );

  const routeHandler = async (req: HE_Request, res: HE_Response) => {
    try {
      const args = params.length > 0
        ? await resolveMethodParams(req, res, params)
        : [req, res];

      const result = await handler.apply(instance, args);
      await handleResponse(req, res, result, outputSchema);
    } catch (err) {
      if (!res.completed) {
        const error = err as any;
        res.status(error.status || 500).json({
          error: error.message || "Internal Server Error",
          code: error.code,
        });
      }
    }
  };

  if (method === "ws" && options) {
    router.ws(path, options, handler.bind(instance));
    return;
  }

  $fn.call(router, path, ...middlewares, routeHandler);
}
