import HyperException from "./HyperException";

export default class NotPropertyException extends HyperException {
  constructor(
    public namespace: string,
    public target: any
  ) {
    super(
      `This decorator cannot be used as a property decorator in ${namespace}`,
      "NotPropertyException",
      {
        target,
      }
    );
  }
}
