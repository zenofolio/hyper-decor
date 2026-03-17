import HyperException from "./HyperException";

export default class DuplicateControllerPathException extends HyperException {
  constructor(data: {
    path: string;
    current: {
      module: string;
      controller: string;
    };
    duplicate: {
      module: string;
      controller: string;
    };
  }) {
    super(
      `Duplicate controller path: '${data.path}' in ${data.current.module}/${data.current.controller} and ${data.duplicate.module} controller: ${data.duplicate.controller}`,
      "DuplicateControllerPathException",
      data
    );
  }
}
