import "reflect-metadata";
import { apiResponse } from "../helpers/response.helper";
import { Responses } from "../types";

export function ApiResponse(options: Responses) {
  return (target: any, propertyKey?: any, descriptor?: any): any => {
    apiResponse(target, propertyKey, options);
  };
}
