import { HyperMeta } from "./metadata";
import { HyperModuleMetadata, Constructor } from "./types";

/**
 * 🚀 HyperModule Decorator
 * Purely injects metadata into the target class.
 */
export function HyperModule(options: HyperModuleMetadata) {
  return (Target: Constructor) => {
    HyperMeta.set(Target, undefined, {
      type: "module",
      ...options,
    });
  };
}
