import { MiddlewareHandler, Request, Response, Router, Server } from "hyper-express";

import { ScopeStore } from "../../collectors";
import roleTransform from "../transform/role.transform";
import scopeTransfrom from "../transform/scope.transfrom";
import { $each } from "../utils/object.util";
import { getDecorData } from "../decorator-base";
import { IHyperAppTarget } from "../../type";
import {
  HyperAppMetadata,
  HyperControllerMetadata,
  HyperModuleMetadata,
  HyperParamerMetadata,
  ImportType,
  LogSpaces,
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
} from "../constants";

import middlewareTransformer from "../transform/middleware.transform";
import { container } from "tsyringe";
import { RouterList } from "../types";
import { join } from "../utils/path.util";
import { prepareImports } from "./imports.helper";

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
  router: Router;
  path: string;
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
    getDecorData<HyperParamerMetadata>(KEY_PARAMS_PARAM, target) ?? {};
  const pass = getDecorData<HyperParamerMetadata>(KEY_PARAMS_PASS, target);

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

  await prepareImports(Target, imports);

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

  const routers = await Promise.all(
    options.modules.map(async (module) => {
      const data = getData(module);
      const path = data.module?.path ?? "/";
      const imports = data.module?.imports ?? [];
      return prepareTarget({
        target: module,
        router: if_router(module),
        namespace: `${Target.name}/${module.name}`,
        instance: app,
        prefix: path,
        imports: imports,
        log,
      });
    })
  );

  routers.forEach(({ router, path }) => {
    app.use(join(prefix, path), router);
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
  prefix = "/",
  namespace = "",
  instance,
  imports = [],
  log,
}: PrepareTargetParams): Promise<PrepareTargetReturn> {
  const _router = router ?? if_router(target);
  const data = getData(target);

  const modules = data.module?.modules ?? [];
  const controllers = data.module?.controllers ?? [];
  const routes = data.routes ?? [];

  const middlewares = data.middlewares ?? [];
  const scopes = data.scopes ?? [];
  const roles = data.roles ?? [];

  ////////////////////////////////
  /// Prepare Imports
  ////////////////////////////////

  await prepareImports(target, imports);

  ////////////////////////////////
  /// Attach Middlewares
  ////////////////////////////////

  _router.use(...middlewares);

  scopeTransfrom(scopes, (middleware, scopes) => {
    ScopeStore.addAll(scopes);
    _router.use(middleware);
  });

  roleTransform(roles, (middleware) => _router.use(middleware));

  ////////////////////////////////
  /// Prepare Modules
  ////////////////////////////////

  await $each(modules, async (module) => {
    const moduleData = getData(module);
    if (!moduleData.module) return;

    const router = await prepareTarget({
      target: module,
      imports: moduleData.module.imports,
      namespace: `${namespace}/${module.name}`,
      prefix: moduleData.module.path,
      instance: container.resolve(module),
      log,
    });

    _router.use(router.path, router.router);
  });

  // ////////////////////////////////
  // /// Prepare Controllers
  // ////////////////////////////////

  await $each(controllers, async (controller) => {
    const data = getData(controller);
    const controllerData = data.controller;
    if (!controllerData) return;

    const router = await prepareTarget({
      target: controller,
      namespace: `${namespace}/${controller.name}`,
      prefix: controllerData.path,
      imports: controllerData.imports,
      instance: container.resolve(controller),
      log,
    });

    _router.use(router.path, router.router);
  });

  ////////////////////////////////
  /// Prepare Routes
  ////////////////////////////////

  await $each(Array.from(routes.routes), async (route) => {
    if (typeof route !== "object") return;
    await prepareRoutes({
      target: target,
      router: _router,
      route,
      namespace,
      instance,
      prefix,
      log,
    });
  });

  return {
    router: _router,
    path: prefix,
  };
}

/**
 * Prepare the routes for the target class.
 *
 * @param param0
 * @returns
 */
async function prepareRoutes({
  target,
  router,
  route,
  instance,
  namespace,
  log,
}: PrepareRouteParams) {
  const { method, path, handler, propertyKey } = route;
  const metadata = getData(handler);
  const params = metadata.params?.params?.[propertyKey] ?? [];
  const $fn = Reflect.get(router, method);
  const hasParams = params.length > 0;

  if (!$fn) return;

  const middlewares = [...metadata.middlewares];
  roleTransform(metadata.roles, (middleware) => middlewares.push(middleware));
  scopeTransfrom(metadata.scopes, (middleware, scopes) => {
    middlewares.push(middleware);
    ScopeStore.addAll(scopes);
  });

  log(
    "routes",
    `${namespace}/${propertyKey} ${method.toUpperCase()} { ${path} }`
  );

  if (!hasParams) {
    $fn.call(router, path, ...middlewares, handler.bind(instance));
  } else {
    $fn.call(
      router,
      path,
      ...middlewares,
      async (req: Request, res: Response) => {
        const args = await Promise.all(
          params.map(async (param) => {
            const { resolver, key } = param;
            return await resolver(req, res);
          })
        );

        return handler.bind(instance)(...args, req, res);
      }
    );
  }
}
