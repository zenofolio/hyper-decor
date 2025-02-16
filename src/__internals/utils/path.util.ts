/**
 * Joins all given paths, removing extra slashes.
 */
export const join = (...paths: (string | null | undefined)[]): string =>
  paths.filter(Boolean).join("/").replace(/\/+/g, "/");
