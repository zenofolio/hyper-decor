import HyperException from "./HyperException";

export default class DuplicatedException extends HyperException {
  constructor(data: {
    path: string;
    currentNameSpace: string;
    duplicateNameSpace: string;
  }) {
    super(
      `Duplicate at path: '${data.path}' in ${data.currentNameSpace} and ${data.duplicateNameSpace}`,
      "DuplicatedException",
      data
    );
  }
}
