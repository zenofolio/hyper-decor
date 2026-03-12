import "reflect-metadata";
import { Schema } from "../types";

/**
 * Collector responsible for transforming DTO classes into OpenAPI Schema objects.
 * Uses design:type and property inspection.
 */
export function collectSchema(Target: any): Schema {
  if (!Target || typeof Target !== "function") {
    return { type: "object" };
  }

  const schema: Schema = {
    type: "object",
    properties: {},
  };

  // Note: Standard reflect-metadata has limitations for property enumeration.
  // In a full implementation, we might use a custom decorator or 
  // class-transformer/class-validator if available.
  // For now, we provide the structure to be extended.
  
  return schema;
}

/**
 * Infer OpenAPI type from JavaScript constructor names.
 */
export function inferType(constructorName: string): string {
  const map: Record<string, string> = {
    String: "string",
    Number: "number",
    Boolean: "boolean",
    Array: "array",
    Object: "object",
    Date: "string", // Dates are strings in OpenAPI
  };

  return map[constructorName] || "string";
}
