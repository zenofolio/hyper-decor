import "reflect-metadata";
import { RESPONSES } from "../constants";
import { OpenApiResponses } from "../types";

export function apiResponse(
  target: any,
  propertyKey: string | symbol,
  options: OpenApiResponses
) {
  const existingResponses: OpenApiResponses =
    Reflect.getMetadata(RESPONSES, target, propertyKey) || {};

  for (const key in options) {
    if (options.hasOwnProperty(key)) {
      const response = options[key];
      existingResponses[key] = {
        description: response.description,
        content: response.content,
      };
    }
  }

  Reflect.defineMetadata(RESPONSES, existingResponses, target, propertyKey);
}
