import HyperException from "./HyperException";

export default class MethodNotFountException extends HyperException {
  constructor(className: string, method: string, path: string) {
    super(
      `Method ${method} not exists in ${className} for path ${path}`,
      "MethodNotFountException"
    );
  }
}
