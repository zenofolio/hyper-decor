import "reflect-metadata";
import { HyperMeta } from "./metadata";

/**
 * 🚀 Output Decorator
 * Purely injects output schema metadata into the method.
 */
export function Output(schema?: any) {
  return (target: any, propertyKey?: any) => {
    HyperMeta.set(target, propertyKey, { output: schema });
  };
}
