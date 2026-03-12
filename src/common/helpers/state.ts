import type { Request } from "hyper-express";

const STATE_SYMBOL = Symbol("HYPER_DECOR_REQUEST_STATE");

/**
 * Get or create the internal state map for the request
 * @param request 
 * @returns 
 */
function getStore(request: any): Map<string, any> {
  if (!request[STATE_SYMBOL]) {
    request[STATE_SYMBOL] = new Map<string, any>();
  }
  return request[STATE_SYMBOL];
}

/**
 * Save a custom value against the request directly via an internal Map
 *
 * @param {Request} request
 * @param {string} key
 * @param {any} value
 */
export const setValue = (request: Request, key: string, value: any) => {
  const store = getStore(request);
  if (value === undefined) {
    store.delete(key);
    return;
  }
  store.set(key, value);
};

/**
 * Get a custom value from the request object directly via an internal Map
 *
 * @param {Request} request
 * @param {string} key
 * @param {any} defaultValue
 */
export const getValue = <T>(
  request: Request,
  key: string,
  defaultValue?: T
): T | any => {
  const store = getStore(request);
  const value = store.get(key);
  return value !== undefined ? (value as T) : defaultValue;
};
