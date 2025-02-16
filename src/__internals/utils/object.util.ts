/**
 * Tipo recursivo para obtener claves anidadas dentro de un objeto, permitiendo solo strings.
 */
export type NestedKeyOf<T> = T extends (infer U)[]
  ? `${number}` | `${number}.${NestedKeyOf<U>}`
  : T extends object
    ? {
        [K in keyof T]: K extends string
          ? K | `${K}.${NestedKeyOf<T[K]>}`
          : never;
      }[keyof T]
    : never;

export type ObjectValue<T, K extends string> = T extends object
  ? K extends keyof T
    ? T[K]
    : K extends `${infer MainKey}.${infer Rest}`
      ? MainKey extends keyof T
        ? ObjectValue<T[MainKey], Rest>
        : never
      : never
  : T;

/**
 * Retrieves a value from an object using a path.
 */
const $get = <T, K extends NestedKeyOf<T>, TDefault extends ObjectValue<T, K>>(
  data: T,
  name?: K,
  def?: TDefault
): TDefault extends undefined ? TDefault | undefined : TDefault => {
  if (!data || !name) return def as any;

  return name.split(".").reduce((data: any, key) => {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      return data[key];
    }

    return def;
  }, data);
};

////////////////////////////////////
// Array utilities
////////////////////////////////////

/**
 * Ensures the given value is returned as an array.
 *
 * @param {T | T[]} value - The value to ensure as an array.
 * @returns {T[]} - The value as an array.
 */
const $array = <T>(value: T | T[]): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

/**
 * Extract constructor from value.
 *
 * @param value
 */
const $constructor = (value: any) => {
  if (typeof value === "object") {
    return value.constructor;
  }

  return value;
};

const $each = async <T>(
  data: T[] | undefined,
  callback: (value: T, index: number) => Promise<any>
) => {
  if (!data || !data.length) return [];
  return await Promise.all(data.map(callback));
};

const $except_slash = (
  message: string,
  length: number = 3,
  middle: boolean = true
) => {
  const parts = message.split("/");
  if (parts.length === 1) return message;

  const middleLength = Math.floor(length / 2);
  length = length - middleLength;

  const start = parts.slice(0, length).join("/");
  const end = parts.slice(-length).join("/");

  if (!middle) return `${start}/.../${end}`;

  return `${start}/.../${parts.slice(-middleLength).join("/")}`;
};

export { $array, $get, $constructor, $each, $except_slash };
