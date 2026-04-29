import { NatsMQMetadata } from "./types";

/**
 * Metadata key used to store NatsMQ configuration on classes.
 * Using Symbol.for to ensure it's truly global across the process.
 */
const METADATA_KEY = Symbol.for("natsmq:metadata");

/**
 * Gets or initializes NatsMQ metadata for a target (class or instance).
 */
export function getNatsMQMeta(target: any): NatsMQMetadata {
  const constructor = typeof target === "function" ? target : target.constructor;
  
  if (!constructor[METADATA_KEY]) {
    constructor[METADATA_KEY] = {
      subscriptions: new Map(),
      crons: new Map(),
      workerOptions: {}
    };
  }
  
  return constructor[METADATA_KEY];
}