import "reflect-metadata";
import { apiResponse } from "../helpers/response.helper";
import { OpenApiResponses } from "../types";

export function ApiResponse(options: OpenApiResponses) {
  return (target: any, propertyKey?: any, descriptor?: any): any => {
    apiResponse(target, propertyKey, options);
  };
}
