import { DESIGN_PARAMTYPES, DESIGN_RETURNTYPE } from "../../__internals/constants";
import { extreactArgsNames } from "../../__internals/utils/function.util";

type OpenAPIParamLocation = "query" | "path" | "body";
type OpenAPIType = "string" | "number" | "boolean" | "object" | "array" | "any";

/**
 * Maps TypeScript types to OpenAPI-compatible types.
 */
const mapTypeToOpenAPI = (type: any): OpenAPIType => {
  if (!type) return "any";

  const typeMap: Record<string, OpenAPIType> = {
    String: "string",
    Number: "number",
    Boolean: "boolean",
    Object: "object",
    Array: "array",
  };

  return type.name === "Array" ? "array" : typeMap[type.name] || "any";
};

/**
 * Formats the response schema for OpenAPI.
 */
const formatResponseSchema = (
  type: any,
  description: string = "Successful response"
) => ({
  description,
  content: {
    "application/json": {
      schema: { type: mapTypeToOpenAPI(type) },
    },
  },
});

/**
 * Options to customize OpenAPI metadata extraction.
 */
interface FunctionDataOptions {
  paramLocation?: OpenAPIParamLocation; // Default: "query"
  paramDescriptions?: Record<string, string>; // Custom parameter descriptions
  responseDescriptions?: Record<number, string>; // Custom response descriptions
  responseSchemas?: Record<number, any>; // Custom response schemas
}

/**
 * Extracts function metadata and adapts it for OpenAPI documentation.
 *
 * @param Target - The function to analyze.
 * @param options - Customization options for OpenAPI extraction.
 * @returns An object formatted for OpenAPI documentation.
 */
export function collectFunctionData(
  Target: (...args: any[]) => any,
  options: FunctionDataOptions = {}
) {
  if (typeof Target !== "function") {
    throw new Error("Target must be a function.");
  }

  // Extract metadata
  const paramTypes = Reflect.getMetadata(DESIGN_PARAMTYPES, Target) || [];
  const paramNames = extreactArgsNames(Target) ?? [];
  const returnType = Reflect.getMetadata(DESIGN_RETURNTYPE, Target);

  // Default locations and descriptions
  const {
    paramLocation = "query",
    paramDescriptions = {},
    responseDescriptions = { 200: "Successful response" },
    responseSchemas = {},
  } = options;

  // Build OpenAPI parameters
  const parameters = paramNames.map((name, index) => ({
    name,
    in: paramLocation,
    required: true,
    description: paramDescriptions[name] || `Parameter ${name}`,
    schema: { type: mapTypeToOpenAPI(paramTypes[index]) },
  }));

  // Build OpenAPI responses
  const responses: Record<number, any> = {};
  Object.entries(responseDescriptions).forEach(([statusCode, description]) => {
    const code = Number(statusCode);
    responses[code] =
      responseSchemas[code] || formatResponseSchema(returnType, description);
  });

  return {
    operationId: Target.name || "anonymous",
    parameters,
    responses,
  };
}
