import HyperException from "./HyperException";

export default class HyperFileException extends HyperException {
  constructor(message: string, additional?: any) {
    super(message, "HyperFileException", additional);
  }
}
