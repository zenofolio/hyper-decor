import type { Request } from "hyper-express";

import {
  defineMetadata,
  deleteMetadata,
  getMetadata,
  hasOwnMetadata,
} from "reflect-metadata/no-conflict";

import { HyperScopeOptions } from "../../type";
import { HYPER_SCOPES_KEY } from "../../constants";
import { $array } from "../../__internals/utils/object.util";

/**
 * Set scopes to request object
 *
 * @param request
 * @param scopes
 */
export const setScopes = (
  request: Request,
  scopes: HyperScopeOptions | null
) => {
  if (!scopes) {
    deleteMetadata(HYPER_SCOPES_KEY, request);
    return;
  }

  defineMetadata(HYPER_SCOPES_KEY, $array(scopes), request);
};

/**
 * Get list of scopes from request object
 *
 * @param request
 */

export const getScopes = (request: Request): string[] | undefined => {
  if (!hasOwnMetadata(HYPER_SCOPES_KEY, request)) {
    return undefined;
  }

  return getMetadata(HYPER_SCOPES_KEY, request);
};

/**
 * Check if request has required scopes
 *
 * @param request - The incoming request
 * @param scopes - Required scopes to check
 * @returns `true` if the request has all required scopes, otherwise `false`
 */
export const hasScopes = (request: Request, scopes: HyperScopeOptions): boolean => {
  const requestScopes = new Set(getScopes(request) || []);
  
  if (requestScopes.has("*")) return true;

  return $array(scopes).every(scope => requestScopes.has(scope));
};