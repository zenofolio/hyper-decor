import { MiddlewareHandler } from "hyper-express";
import { ScopeType } from "../../decorators";
import { NotScopeException } from "../../exeptions";
import { getScopes } from "../../common/helpers";

export default function scopeTransfrom(
  listScopes: ScopeType[],
  callback?: (
    middleware: MiddlewareHandler,
    scopes: {
      scope: string;
      description: string;
      message: string | null;
    }[],
    names: Set<string>
  ) => void
): MiddlewareHandler {
  const { scopes, scopeNames, isEmtpy } = resolveScopes(listScopes);

  const middleware: MiddlewareHandler = (req, res, next) => {
    // if scopes is empty, then we don't need to check for scopes
    if (isEmtpy) return next();

    // get the user scopes
    const userScopes = getScopes(req);

    // find the first scope that is not in the userScopes
    const error = scopes.find((scope) => !userScopes?.includes(scope.scope));

    if (error) {
      return next(
        new NotScopeException(
          error.message ??
            `You don't have the required scopes to access this resource`,
          userScopes,
          Array.from(scopeNames)
        )
      );
    }

    return next();
  };

  if (scopeNames.size > 0 && callback) {
    callback(middleware, scopes, scopeNames);
  }

  return middleware;
}

/**
 *
 * Convert list of scopes to a standard format
 *
 * @param scopes
 * @returns
 */
const resolveScopes = (scopes: ScopeType[]) => {
  const $scopes = {} as {
    [key: string]: {
      scope: string;
      description: string;
      message: string | null;
    };
  };

  for (const scope of scopes) {
    if (typeof scope === "string") {
      $scopes[scope] = {
        scope,
        description: "",
        message: null,
      };
    } else if (Array.isArray(scope)) {
      for (const s of scope) {
        switch (typeof s) {
          case "string":
            $scopes[s] = {
              scope: s,
              description: "",
              message: null,
            };
            break;
          case "object":
            $scopes[s.scope] = {
              scope: s.scope,
              description: s.description ?? "",
              message: s.message ?? null,
            };
            break;
        }
      }
    }
  }

  const values = Object.values($scopes);

  return {
    scopes: values,
    scopeNames: new Set(Object.keys($scopes)),
    isEmtpy: values.length === 0,
  };
};
