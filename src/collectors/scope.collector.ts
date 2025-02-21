import { ScopeMap } from "../decorators";

/**
 * This class is a store for the scopes that are defined in the application.
 *
 */
export class ScopeStore {
  private static scopes = new Map<string, ScopeMap>();

  static add(scope: ScopeMap) {
    this.scopes.set(scope.scope, scope); // Evita duplicados basados en el nombre del scope
  }

  static addAll(scopes: ScopeMap[]) {
    scopes.forEach((scope) => this.add(scope));
  }

  static getScopes(): ScopeMap[] {
    return Array.from(this.scopes.values());
  }

  static getScopeNames(): string[] {
    return Array.from(this.scopes.keys());
  }

  static isEmpty() {
    return this.scopes.size === 0;
  }

  static clear() {
    this.scopes.clear();
  }
}
