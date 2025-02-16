import { MiddlewareHandler } from "hyper-express";
import { RoleType } from "../../decorators";
import { NotRoleException } from "../../exeptions";
import { getRoles } from "../../common/helpers";

export default function roleTransform(
  list: RoleType[],
  callback?: (
    middleware: MiddlewareHandler,
    roles: {
      role: string;
      description: string;
      message: string | null;
    }[],
    names: Set<string>
  ) => void
): MiddlewareHandler {
  const { roles, names, isEmtpy } = resolveRoles(list);

  const middleware: MiddlewareHandler = (req, res, next) => {
    // if scopes is empty, then we don't need to check for scopes
    if (isEmtpy) return next();

    // get the user scopes
    const requestRoles = getRoles(req);

    // find the first scope that is not in the userScopes
    const role = roles.find((scope) => requestRoles?.includes(scope.role));

    if (role) {
      return next();
    }

    return next(
      new NotRoleException(
        `Only ${Array.from(names).join(", ")} can access this resource`,
        requestRoles,
        Array.from(names)
      )
    );
  };

  if (names.size > 0 && callback) {
    callback(middleware, roles, names);
  }

  return middleware;
}

/**
 *
 * Convert list of roles to a standard format
 *
 * @param list
 * @returns
 */
const resolveRoles = (list: RoleType[]) => {
  const $roles = [] as {
    role: string;
    description: string;
    message: string | null;
  }[];

  for (const role of list) {
    if (typeof role === "string") {
      $roles.push({
        role: role,
        description: "",
        message: null,
      });
    } else if (Array.isArray(role)) {
      for (const s of role) {
        switch (typeof s) {
          case "string":
            $roles.push({
              role: s,
              description: "",
              message: null,
            });
            break;
          case "object":
            $roles.push({
              role: s.role,
              description: s.description ?? "",
              message: s.message ?? null,
            });
            break;
        }
      }
    } else {
      if (typeof role === "object") {
        $roles.push({
          role: role.role,
          description: role.description ?? "",
          message: role.message ?? null,
        });
      } else {
        $roles.push({
          role: role,
          description: "",
          message: null,
        });
      }
    }
  }

  return {
    roles: $roles,
    names: new Set($roles.map((s) => s.role)),
    isEmtpy: $roles.length === 0,
  };
};
