import "reflect-metadata";
import {
  METHOD_SUMMARY,
  METHOD_OPERATION_ID,
  METHOD_TAGS,
  RESPONSES,
} from "../constants";
import { Operation } from "../types";
import { apiResponse } from "./response.helper";

export function apimethod(
  target: any,
  propertyKey: string | symbol,
  options: Partial<Operation>
) {
  if (options.summary) {
    Reflect.defineMetadata(
      METHOD_SUMMARY,
      options.summary,
      target,
      propertyKey
    );
  }
  if (options.operationId) {
    Reflect.defineMetadata(
      METHOD_OPERATION_ID,
      options.operationId,
      target,
      propertyKey
    );
  }
  if (options.tags) {
    Reflect.defineMetadata(METHOD_TAGS, options.tags, target, propertyKey);
  }
  if (options.responses) {
    apiResponse(target, propertyKey, options.responses);
  }
}
