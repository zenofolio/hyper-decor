import { HyperMeta } from "./metadata";
import { HyperControllerMetadata } from "./types";

/**
 * 🚀 HyperController Decorator
 * Purely injects metadata into the target class.
 */
export function HyperController(options?: HyperControllerMetadata | string) {
  return (Target: any) => {
    const isString = typeof options === "string";
    const meta: HyperControllerMetadata = {
      path: isString ? options : options?.path ?? "/",
      roles: isString ? [] : options?.roles ?? [],
      scopes: isString ? [] : options?.scopes ?? [],
      imports: isString ? [] : options?.imports ?? [],
    };

    HyperMeta.set(Target, undefined, {
      type: 'controller',
      ...meta,
    });
  };
}
