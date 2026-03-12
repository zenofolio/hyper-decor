import "reflect-metadata";
import { KEY_PARAMS_TRANSFORM } from "../__internals/constants";
import { defineDecorData } from "../__internals/decorator-base";

export interface TransformOptions {
  /**
   * Where to extract the data from. Defaults to 'body'.
   */
  from?: 'body' | 'query' | 'params' | 'headers';
}

/**
 * Agnostic decorator to transform/validate request data using a registered transformer.
 * 
 * @param schema The schema or object to be used by the registered transformer.
 * @param options Transformation options.
 */
export function Transform(schema: any, options: TransformOptions = {}) {
  return (target: any, propertyKey: any) => {
    const data = { schema, options };
    defineDecorData(KEY_PARAMS_TRANSFORM, data, target, propertyKey);
  };
}
