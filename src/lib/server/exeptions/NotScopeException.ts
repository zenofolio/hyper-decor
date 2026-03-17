import HyperException from "./HyperException";

export default class NotScopeException extends HyperException {
  constructor(
    public message: string,
    public requestScopes: string[] = [],
    public requiredScopes: string[] = []
  ) {
    super(
      message || `You don't have the required scopes to access this resource`,
      "NotScopeException",
      {
        requestScopes,
        requiredScopes,
      }
    );
  }
}
