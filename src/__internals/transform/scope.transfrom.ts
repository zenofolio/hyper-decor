import { MiddlewareHandler } from "hyper-express";
import { ScopeMap, ScopeType } from "../../decorators";
import { NotScopeException } from "../../exeptions";
import { getScopes } from "../../common/helpers";

type Callback = (
  middleware: MiddlewareHandler,
  scopes: ScopeMap[],
  names: Set<string>
) => void;


export default function scopeTransfrom(
  listScopes: ScopeType[],
  ...callback: Callback[]
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

  if (scopeNames.size > 0 && callback && callback.length > 0) {
    for (const cb of callback) cb(middleware, scopes, scopeNames);
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
const resolveScopes = (
  scopes: ScopeType[]
): {
  scopes: ScopeMap[];
  scopeNames: Set<string>;
  isEmtpy: boolean;
} => {
  const $scopes = {} as {
    [key: string]: ScopeMap;
  };

  for (const scope of scopes) {
    if (typeof scope === "string") {
      $scopes[scope] = {
        scope,
        description: "",
      };
    } else if (Array.isArray(scope)) {
      for (const s of scope) {
        switch (typeof s) {
          case "string":
            $scopes[s] = {
              scope: s,
              description: "",
            };
            break;
          case "object":
            $scopes[s.scope] = {
              scope: s.scope,
              description: s.description ?? "",
              message:
                s.message ??
                `You don't have the required scopes to access this resource`,
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
