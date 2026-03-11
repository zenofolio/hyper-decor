import { container } from "tsyringe";
import { IHyperHooks, ImportType } from "../../decorators/types";
import { initializeInstance, isInitialized } from "./lifecycle.helper";
import { getDecorData } from "../decorator-base";
import { OnMessageMetadata } from "../../decorators/Messaging";
import { METADATA_KEYS } from "../constants";
import { MessageBus } from "../../common/message-bus";

/**
 * Prepare imports for the target class.
 *
 * @param target
 * @param imports
 */
export async function prepareImports(_target: any, imports: ImportType[], hooks?: IHyperHooks, context?: any) {
  const bus = container.resolve(MessageBus);

  await Promise.all(
    imports.map(async (item) => {
      let token: any;

      if (typeof item === "function" || typeof item === "string" || typeof item === "symbol") {
        token = item;
      } else if (item && typeof item === "object" && "token" in item) {
        token = item.token;
        if (item.useClass) {
          container.register(token, { useClass: item.useClass }, item.options);
        } else if ("useValue" in item) {
          container.registerInstance(token, item.useValue);
          return;
        } else if (item.useFactory) {
          container.register(token, { useFactory: item.useFactory } as any, item.options);
          return;
        } else if (item.useToken) {
          container.register(token, { useToken: item.useToken } as any, item.options);
          return;
        }
      }

      if (!token) return;

      try {
        const instance = container.resolve(token as any) as any;
        if (!instance) return;

        // Skip if already initialized to avoid double work/double subscription
        const alreadyDone = isInitialized(instance);

        if (!alreadyDone) {
          if (hooks?.onBeforeInit) {
            await hooks.onBeforeInit(instance, token, context);
          }
        }

        await initializeInstance(instance);

        if (!alreadyDone) {
          if (hooks?.onAfterInit) {
            await hooks.onAfterInit(instance, token, context);
          }

          // Handle singleton registration if it's a constructor and not registered
          if (typeof token === "function" && !container.isRegistered(token)) {
            const isSingleton = typeof instance.isSingleton === "function" ? instance.isSingleton() : true;
            if (isSingleton) {
              container.registerInstance(token, instance);
            }
          }

          // Discovery: Messaging (only on first init)
          const messaging = getDecorData<OnMessageMetadata[]>(
            METADATA_KEYS.ON_MESSAGE,
            typeof token === "function" ? token : instance.constructor
          );

          if (messaging?.length) {
            messaging.forEach((msg) => {
              bus.listen(msg.topic, instance[msg.propertyKey].bind(instance));
            });
          }
        }
      } catch (e: any) {
        // Skip dependencies that cannot be resolved automatically
        // Log a warning to prevent silent failures in production
        const name = typeof token === "function" ? token.name : String(token);
        console.warn(`[HyperDecor] Warn: Could not resolve dependency for token "${name}". It might be missing injectable() or not exported correctly.`);
      }
    })
  );
}
