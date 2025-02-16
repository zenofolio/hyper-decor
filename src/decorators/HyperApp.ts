import "reflect-metadata";
import {
  KEY_PARAMS_APP,
  KEY_PARAMS_MIDDLEWARES,
  KEY_PARAMS_MODULE,
  KEY_PARAMS_PARAM,
  KEY_PARAMS_PASS,
  KEY_PARAMS_ROLE,
  KEY_PARAMS_ROUTE,
  KEY_PARAMS_SCOPE,
  KEY_TYPE_APP,
  KEY_TYPE_CONTROLLER,
} from "../__internals/constants";
import {
  HyperAppMetadata,
  HyperControllerMetadata,
  HyperModuleMetadata,
  HyperAppDecorator,
  RoleType,
  RouteMetadata,
  ScopeType,
  HyperParamerMetadata,
  LogSpaces,
} from "./types";
import {
  MiddlewareHandler,
  Request,
  Response,
  Router,
  Server,
} from "hyper-express";

import { DecoratorHelper, getDecorData } from "../__internals/decorator-base";
import { IHyperAppTarget } from "../type";
import { join } from "../__internals/utils/path.util";
import scopeTransfrom from "../__internals/transform/scope.transfrom";
import roleTransform from "../__internals/transform/role.transform";
import { RouterList } from "../__internals/types";
import { $each } from "../__internals/utils/object.util";
import { mergeMetadata } from "../__internals/helpers/merge-metadata";
import { container, injectable } from "tsyringe";

/**
 * Decorator to define the main application class with assigned modules.
 * @param modules - List of modules to be used in the application.
 */

export const HyperApp: HyperAppDecorator = (options) =>
  DecoratorHelper<HyperAppMetadata, IHyperAppTarget>(
    {
      type: KEY_TYPE_APP,
      key: KEY_PARAMS_APP,
      options: options ?? { modules: [] },
    },
    (options, Target) => {
      return class extends Server {
        private listArguments: any[] = [];
        private storeLogs: Record<string, string[]> = {};

        constructor(...args: any[]) {
          super(options.options);
          this.listArguments = args;
        }

        async prepare() {
          this.mergeMetadata(Target);
          await this.applyOptions(Target);
        }

        /** Fusiona los metadatos relevantes al Target */
        private mergeMetadata(targetPrototype: any) {
          mergeMetadata(targetPrototype, this.constructor, [
            KEY_PARAMS_MIDDLEWARES,
            KEY_PARAMS_SCOPE,
            KEY_PARAMS_ROLE,
            KEY_PARAMS_PASS,
          ]);
        }

        /** Aplica las opciones y prepara la instancia del Target */
        private async applyOptions(Target: any) {
          await applyAppOptions(options, Target, this, this.log.bind(this));
          const target = Reflect.construct(Target, this.listArguments);
          (target as any)?.onPrepare?.();
          this.showLogs();
        }

        /** Maneja los logs respetando las opciones configuradas */
        private log(space: keyof LogSpaces, message: string) {
          if (options.logs?.[space] === false) return;
          (this.storeLogs[space] ||= []).push(`- ${message}`);
        }

        private showLogs() {
          const content = ["\n\n"];

          content.push("/////////////////////////////");
          content.push(`- HyperExpress Application`);
          content.push(
            `- ${options.name ?? "Hyper App"} - ${options.version ?? "1.0.0"}`
          );
          content.push("/////////////////////////////\n");

          content.push("\nLogs:");

          Object.entries(this.storeLogs).forEach(([space, logs]) => {
            if (!logs.length) return;
            content.push(`- [${space.toUpperCase()}]`);
            logs.forEach((log) => content.push(`  ${log}`));
            content.push("");
          });

          options.logger?.call(this, content.join("\n"));
        }
      };
    }
  );

//////////////////////////////////
/// Private methods
//////////////////////////////////

const if_router = (current?: any | null): Router => {
  if (!current || !(current?.prototype instanceof Router)) return new Router();
  return new current();
};

function getData(target: any) {
  const app = getDecorData<IHyperAppTarget>(KEY_PARAMS_APP, target);
  const module = getDecorData<HyperModuleMetadata>(KEY_PARAMS_MODULE, target);
  const controller = getDecorData<HyperControllerMetadata>(
    KEY_TYPE_CONTROLLER,
    target
  );

  const middlewares =
    getDecorData<MiddlewareHandler[]>(KEY_PARAMS_MIDDLEWARES, target) ?? [];
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

async function applyAppOptions(
  options: HyperAppMetadata,
  Target: any,
  app: Server,
  log: (space: keyof LogSpaces, message: string) => void
) {
  const data = getData(Target);
  const prefix = options.prefix ?? "/";
  const services = options.imports ?? [];

  if (data.middlewares.length) {
    app.use(...data.middlewares);
    log(
      "middleware",
      `${Target.name} with middlewares: ${data.middlewares.map((e) => e.name).join(", ")}`
    );
  }

  scopeTransfrom(data.scopes, (middleware) => {
    app.use(middleware);
    log("middleware", `${Target.name} with scopes: ${data.scopes.join(", ")}`);
  });

  roleTransform(data.roles, (middleware) => {
    app.use(middleware);
    log("middleware", `${Target.name} with roles: ${data.roles.join(", ")}`);
  });

  const routers = await Promise.all(
    options.modules.map(async (module) => {
      const path = getData(module).module?.path ?? "/";
      return prepareTarget({
        target: module,
        router: if_router(module),
        namespace: `${Target.name}/${module.name}`,
        instance: app,
        prefix: path,
        log,
      });
    })
  );

  routers.forEach(({ router, path }) => {
    app.use(join(prefix, path), router);
  });
}

interface PrepareTargetParams {
  target: any;
  router?: Router;
  prefix?: string;
  namespace?: string;
  instance?: any;
  log: (space: keyof LogSpaces, message: string) => void;
}

interface PrepareTargetReturn {
  router: Router;
  path: string;
}

async function prepareTarget({
  target,
  router,
  prefix = "/",
  namespace = "",
  instance,
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
  /// Attach Middlewares
  ////////////////////////////////

  _router.use(...middlewares);
  scopeTransfrom(scopes, (middleware) => _router.use(middleware));
  roleTransform(roles, (middleware) => _router.use(middleware));

  ////////////////////////////////
  /// Prepare Modules
  ////////////////////////////////

  await $each(modules, async (module) => {
    const moduleData = getData(module);
    if (!moduleData.module) return;

    const router = await prepareTarget({
      target: module,
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

async function prepareRoutes({
  target,
  router,
  route,
  instance,
  namespace,
  prefix,
  scopes = [],
  roles = [],
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
  scopeTransfrom(metadata.scopes, (middleware) => middlewares.push(middleware));

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
