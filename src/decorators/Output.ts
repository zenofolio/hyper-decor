import "reflect-metadata";
import { defineDecorData } from "../__internals/decorator-base";
import { KEY_OUTPUT_SCHEMA } from "../__internals/constants";

/**
 * Decorator to explicitly mark a method for response transformation and OpenAPI documentation.
 * 
 * @param schema The schema or DTO class for the successful response (200).
 * @example
 * \@Output(UserDto)
 */
export function Output(schema?: any) {
  return (target: any, propertyKey?: any, descriptor?: PropertyDescriptor) => {
    defineDecorData(KEY_OUTPUT_SCHEMA, schema, target, propertyKey);
  };
}
