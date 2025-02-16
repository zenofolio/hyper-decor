import type { Request } from "hyper-express";
import {
  defineMetadata,
  deleteMetadata,
  getMetadata,
} from "reflect-metadata/no-conflict";

import { HYPER_ROLE_KEY } from "../../constants";
import { HyperRoleOptions } from "../../type";
import { $array } from "../../__internals/utils/object.util";

/**
 * Set role to request object
 *
 * @param {Request} request
 * @param {HyperRoleOptions} role
 */
export const setRole = (request: Request, role: HyperRoleOptions | null) => {
  if (!role) {
    deleteMetadata(HYPER_ROLE_KEY, request);
    return;
  }

  defineMetadata(HYPER_ROLE_KEY, $array(role), request);
};

/**
 * Get list of roles from request object
 *
 * @param {Request} request
 */
export const getRoles = (request: Request): string[] | undefined => {
  return getMetadata(HYPER_ROLE_KEY, request);
};

/**
 * Check if user has role
 *
 * @param {Request} request
 * @param {string | string[]} role
 */
export const hasRole = (request: Request, role: string | string[]) => {
  const roles = getRoles(request);

  if (!roles) {
    return false;
  }

  return $array(role).every((r) => roles.includes(r));
};
