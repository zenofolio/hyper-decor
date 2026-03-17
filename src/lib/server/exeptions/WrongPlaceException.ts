import HyperException from "./HyperException";

export default class WrongPlaceException extends HyperException {
  constructor(
    public decorator: string,
    public as: string,
    public namespace: string,
    public target: any
  ) {
    super(
      `The decorator @${decorator} only can be used as a ${as} decorator. Error => ${namespace}`,
      "WrongPlaceException",
      {
        decorator,
        target,
        namespace,
        as,
      }
    );
  }
}
