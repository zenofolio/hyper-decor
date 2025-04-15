import { MiddlewareHandler } from "hyper-express/types";
import { ScopeMap, ScopeType } from "../../decorators";
import { NotScopeException } from "../../exeptions";
import { getScopes } from "../../common/helpers";
import { FULL_ACCESS } from "../constants";

type Callback = (
  middleware: MiddlewareHandler,
  scopes: ScopeMap[],
  names: Set<string>
) => void;

export default function scopeTransfrom(
  listScopes: ScopeType[],
  ...callback: Callback[]
): MiddlewareHandler {
  const { scopes, scopeNames, isEmpty } = resolveScopes(listScopes);

  const middleware: MiddlewareHandler = (req, res, next) => {
    if (isEmpty) return next();

    const userScopesRaw = getScopes(req);
    if (!userScopesRaw || userScopesRaw.length === 0) {
      return next(
        new NotScopeException(`FORBIDDEN`, [], Array.from(scopeNames))
      );
    }

    const userScopes = new Set(userScopesRaw);
    if (userScopes.has(FULL_ACCESS)) return next();

    for (const scope of scopes) {
      if (!userScopes.has(scope.scope)) {
        return next(
          new NotScopeException(
            scope.message ?? `FORBIDDEN`,
            userScopesRaw,
            Array.from(scopeNames)
          )
        );
      }
    }

    return next();
  };

  if (!isEmpty && callback.length > 0) {
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
  isEmpty: boolean;
} => {
  const $scopes = {} as {
    [key: string]: ScopeMap;
  };

  for (const scope of scopes) {
    const list = parseScope(scope);
    if (list.length === 0) continue;

    for (const s of list) {
      $scopes[s.scope] = {
        scope: s.scope,
        description: s.description ?? "",
        message:
          s.message ??
          `You don't have the required scopes to access this resource`,
      };
    }
  }

  const values = Object.values($scopes);

  return {
    scopes: values,
    scopeNames: new Set(Object.keys($scopes)),
    isEmpty: values.length === 0,
  };
};

/**
 * Parse the scope to a standard format
 *
 * @param scope
 * @returns
 */
const parseScope = (scope: ScopeType): ScopeMap[] => {
  switch (typeof scope) {
    case "string":
      return [
        {
          scope,
          description: "",
        },
      ];
    case "object":
      if (Array.isArray(scope)) {
        if (scope.length === 0) return [];
        return scope.map((s) => parseScope(s)).flat();
      } else {
        return [scope];
      }
  }
};
