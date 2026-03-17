import { container, InjectionToken } from "tsyringe";
import { ImportType, IHyperHooks, OnInit, ImportObject, Constructor } from "../../lib/server/decorators/types";
import { MessageBus } from "../../common/message-bus";

/**
 * Prepare the imports for the target class.
 *
 * @param _target
 * @param imports
 */
export async function prepareImports(_target: Constructor | object, imports: ImportType[], hooks?: IHyperHooks, context?: unknown) {
  const bus = container.resolve(MessageBus);

  await Promise.all(
    imports.map(async (item) => {
      let instance: Record<string, any> | undefined;
      let token: InjectionToken;

      if (typeof item === "function") {
        if (!container.isRegistered(item)) {
          container.register(item, item as Constructor);
        }
        token = item;
        instance = container.resolve(item) as Record<string, any>;
      } else if (typeof item === "object" && item !== null) {
        const importObj = item as ImportObject;
        token = importObj.token;

        if (importObj.useClass) {
          container.register(token, { useClass: importObj.useClass });
        } else if (importObj.useValue) {
          container.register(token, { useValue: importObj.useValue } as any);
        } else if (importObj.useFactory) {
          container.register(token, { useFactory: importObj.useFactory } as any);
        } else if (importObj.useToken) {
          container.register(token, { useToken: importObj.useToken } as any);
        }

        instance = container.resolve(token) as Record<string, any>;
      } else {
        // Primitive or already registered token
        token = item as InjectionToken;
        instance = container.resolve(token) as Record<string, any>;
      }

      if (instance) {
        if (hooks?.onBeforeInit) {
          await hooks.onBeforeInit(instance, token, context);
        }

        if (typeof (instance as Partial<OnInit>).onInit === "function") {
          await (instance as OnInit).onInit();
        }

        if (hooks?.onAfterInit) {
          await hooks.onAfterInit(instance, token, context);
        }
      }
    })
  );
}
