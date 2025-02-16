import { ExceptionType } from "./types";

export default class HyperException extends Error {
  constructor(
    message: string,
    public code: ExceptionType = "HyperException",
    public additionalInfo: any = {}
  ) {
    super(message);
  }

  static throw(message: string, code?: ExceptionType, additionalInfo = {}) {
    throw new this(message, code, additionalInfo);
  }
}
