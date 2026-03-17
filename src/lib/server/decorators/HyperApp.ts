import { HyperMeta } from "./metadata";
import { HyperAppMetadata, Constructor } from "./types";

/**
 * 🚀 HyperApp Decorator
 * Purely injects metadata and a prepare method into the target class.
 * No class wrapping or modification of the original constructor.
 */
export function HyperApp(options: HyperAppMetadata) {
  return (Target: Constructor) => {
    HyperMeta.set(Target, undefined, {
      type: 'app',
      ...options,
      modules: options.modules || [],
    });
  };
}
