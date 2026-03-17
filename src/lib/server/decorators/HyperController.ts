import { HyperMeta } from "./metadata";
import { HyperControllerMetadata } from "./types";

/**
 * 🚀 HyperController Decorator
 * Purely injects metadata into the target class.
 */
export function HyperController(options?: HyperControllerMetadata | string) {
  return (Target: any) => {
    const isString = typeof options === "string";
    const data: any = {
      type: "controller",
      path: isString ? options : options?.path ?? "/",
    };

    if (!isString && options) {
      if (options.roles) data.roles = options.roles;
      if (options.scopes) data.scopes = options.scopes;
      if (options.imports) data.imports = options.imports;
    }

    HyperMeta.set(Target, undefined, data);
  };
}
