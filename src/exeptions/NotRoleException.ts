import HyperException from "./HyperException";

export default class NotRoleException extends HyperException {
  constructor(
    message: string = `Has not Permission to access this resource`,
    public roles: string[] = [],
    public requiredRoles: string[] = []
  ) {
    super(message, "NotRoleException", {
      roles,
      requiredRoles,
    });
  }
}
