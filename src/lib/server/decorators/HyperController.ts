import { HyperMeta } from "./metadata";
import { HyperControllerMetadata } from "./types";

/**
 * 🚀 HyperController Decorator
 * Purely injects metadata into the target class.
 */
export function HyperController(options?: HyperControllerMetadata | string) {
  return (Target: any) => {
    const isString = typeof options === "string";
    const data: any = isString ? { path: options } : (options ?? {});

    HyperMeta.set(Target, undefined, {
      type: "controller",
      ...data,
    });
  };
}
