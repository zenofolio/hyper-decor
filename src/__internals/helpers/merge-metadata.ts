import { Metadata } from "../stores/meta.store";
import { HyperMetadataStore, HyperPrefixRoot, HyperCommonMetadata, HyperMethodMetadata } from "../types";

/**
 * Perform a clean merge of prefixes
 */
const HyperMeta = Metadata.prefix<HyperCommonMetadata, HyperMethodMetadata>('server');

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
  target: object,
  source: object,
  keys: (keyof HyperCommonMetadata)[],
  options: MergeOptions = {}
): void {
  const sourceRoot = Metadata.get<HyperMetadataStore>(source);
  const targetRoot = Metadata.get<HyperMetadataStore>(target);

  const sourceServer = sourceRoot.server;
  if (!sourceServer) return;

  const sourceCommon = sourceServer.common;
  const targetServer = targetRoot.server ||= { common: { type: 'controller' } as HyperCommonMetadata, methods: {} };
  const targetCommon = targetServer.common;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = (sourceCommon as any)[key]; // Narrowing complex union access
    if (value === undefined) continue;

    const current = (targetCommon as any)[key];
    const merged = current === undefined
      ? value
      : deepMerge(current, value, options);

    (targetCommon as any)[key] = merged;
  }

  // Also merge methods if they exist to preserve routes/params when extending
  if (sourceServer.methods) {
    const sourceMethods = sourceServer.methods;
    const targetMethods = targetServer.methods ||= {};

    Object.keys(sourceMethods).forEach(methodKey => {
      targetMethods[methodKey] = deepMerge(targetMethods[methodKey] || {}, sourceMethods[methodKey], options) as HyperMethodMetadata;
    });
  }
}

function deepMerge<T>(target: T, source: T, options: MergeOptions): T {
  if (Array.isArray(target) && Array.isArray(source)) {
    if (options.overwriteArrays) return source;
    // Faster deduplication for primitive arrays
    const combined = target.concat(source);
    return Array.from(new Set(combined)) as unknown as T;
  }

  if (source && typeof source === "object" && target && typeof target === "object") {
    const result = { ...(target as object) } as Record<string, unknown>;
    const sourceObj = source as Record<string, unknown>;
    const sourceKeys = Object.keys(sourceObj);
    for (let i = 0; i < sourceKeys.length; i++) {
      const k = sourceKeys[i];
      result[k] = deepMerge(result[k], sourceObj[k], options);
    }
    return result as unknown as T;
  }

  return source;
}
