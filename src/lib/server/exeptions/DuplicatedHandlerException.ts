import HyperException from "./HyperException";

export default class DuplicatedHandlerException extends HyperException {
  constructor(message: string) {
    super(message, "DuplicateHandlerException");
  }
}
