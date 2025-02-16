import "reflect-metadata";

type MetadataKey = string | symbol;

type MergeOptions = {
  overwriteArrays?: boolean; // If true, arrays are overwritten instead of merged
};

/**
 * Performs a deep merge of metadata from source to target using reflect-metadata.
 * @param target Object where the metadata will be merged.
 * @param source Object from which the metadata will be copied.
 * @param keys Metadata keys to merge.
 * @param options Merge options (e.g., array handling).
 */
export function mergeMetadata(
  target: any,
  source: any,
  keys: MetadataKey[],
  options: MergeOptions = {}
): void {
  for (const key of keys) {
    const sourceMeta = Reflect.getMetadata(key, source);
    const targetMeta = Reflect.getMetadata(key, target);

    if (sourceMeta === undefined) continue;

    let mergedMeta = sourceMeta;
    if (typeof sourceMeta === "object" && typeof targetMeta === "object") {
      mergedMeta = deepMerge(targetMeta, sourceMeta, options);
    }

    Reflect.defineMetadata(key, mergedMeta, target);
  }
}

/**
 * Performs a deep merge of two objects.
 * @param target Target object.
 * @param source Source object.
 * @param options Merge options.
 * @returns Merged object.
 */
function deepMerge<T>(target: T, source: T, options: MergeOptions): T {
  if (Array.isArray(target) && Array.isArray(source)) {
    return (options.overwriteArrays ? source : Array.from(new Set([...target, ...source]))) as T;
  }

  if (typeof target === "object" && target !== null && typeof source === "object" && source !== null) {
    const merged = { ...target } as any;
    for (const key of Object.keys(source)) {
      merged[key] = deepMerge((target as any)[key], (source as any)[key], options);
    }
    return merged;
  }

  return source;
}
