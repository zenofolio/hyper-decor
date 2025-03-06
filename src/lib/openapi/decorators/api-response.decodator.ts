import "reflect-metadata";
import { apiResponse } from "../helpers/response.helper";
import { Responses } from "../types";

export function ApiResponse(options: Responses) {
  return (target: any, propertyKey: string) => {
    apiResponse(target, propertyKey, options);
  };
}
