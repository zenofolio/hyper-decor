import "reflect-metadata";
import { collectFunctionData } from "./collect-function-data";

/**
 * Options to customize class metadata extraction.
 */
interface ClassDataOptions {
  includePrivateMethods?: boolean; // Include private methods (default: false)
  methodOptions?: Record<string, any>; // Custom options for method extraction
}

/**
 * Extracts metadata from a class, including methods and OpenAPI data.
 *
 * @param Target - The class constructor.
 * @param options - Options for metadata extraction.
 * @returns Object containing class metadata and method details.
 */
export function collectClassData(
  Target: new (...args: any[]) => any,
  options: ClassDataOptions = {}
) {
  if (typeof Target !== "function") {
    throw new Error("Target must be a class constructor.");
  }

  const prototype = Target.prototype;
  const className = Target.name;

  // Get method names
  const allMethods = Object.getOwnPropertyNames(prototype).filter(
    (name) => typeof prototype[name] === "function" && name !== "constructor"
  );

  // Get static methods
  const staticMethods = Object.getOwnPropertyNames(Target).filter(
    (name) => typeof (Target as any)[name] === "function"
  );

  // Filter private methods (if not included)
  const isPrivate = (name: string) => name.startsWith("_");
  const methods = options.includePrivateMethods
    ? allMethods
    : allMethods.filter((m) => !isPrivate(m));

  // Extract metadata for each method
  const methodsData = methods.reduce(
    (acc, methodName) => {
      acc[methodName] = collectFunctionData(
        prototype[methodName],
        options.methodOptions?.[methodName] || {}
      );
      return acc;
    },
    {} as Record<string, any>
  );

  // Extract metadata for static methods
  const staticMethodsData = staticMethods.reduce(
    (acc, methodName) => {
      acc[methodName] = collectFunctionData(
        (Target as any)[methodName],
        options.methodOptions?.[methodName] || {}
      );
      return acc;
    },
    {} as Record<string, any>
  );

  return {
    className,
    methods: methodsData,
    staticMethods: staticMethodsData,
  };
}
