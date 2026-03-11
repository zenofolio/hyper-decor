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
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const sourceMeta = Reflect.getMetadata(key, source);
    if (sourceMeta === undefined) continue;

    const targetMeta = Reflect.getMetadata(key, target);
    Reflect.defineMetadata(
      key,
      targetMeta === undefined ? sourceMeta : deepMerge(targetMeta, sourceMeta, options),
      target
    );
  }
}

function deepMerge<T>(target: T, source: T, options: MergeOptions): T {
  if (Array.isArray(target) && Array.isArray(source)) {
    if (options.overwriteArrays) return source;
    // Faster deduplication for primitive arrays
    const combined = target.concat(source);
    return Array.from(new Set(combined)) as any;
  }

  if (source && typeof source === "object" && target && typeof target === "object") {
    const result = { ...target } as any;
    const sourceKeys = Object.keys(source);
    for (let i = 0; i < sourceKeys.length; i++) {
        const k = sourceKeys[i];
        result[k] = deepMerge(result[k], (source as any)[k], options);
    }
    return result;
  }

  return source;
}
