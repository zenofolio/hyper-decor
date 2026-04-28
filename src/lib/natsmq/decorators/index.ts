import "reflect-metadata";
import { z } from "zod";

import type { ConsumerConfig, JsMsg } from "nats";
import { NatsMessageContract } from "../contracts";

// --- Metadata Keys ---
export const NATSMQ_CLIENT_METADATA = Symbol("NATSMQ_CLIENT_METADATA");
export const NATSMQ_SUBSCRIPTION_METADATA = Symbol("NATSMQ_SUBSCRIPTION_METADATA");
export const NATSMQ_CONCURRENCY_METADATA = Symbol("NATSMQ_CONCURRENCY_METADATA");
export const NATSMQ_CRON_METADATA = Symbol("NATSMQ_CRON_METADATA");

// --- Options Interfaces ---
export interface NatsSubscriptionOptions extends Partial<ConsumerConfig> {
  stream?: string;
  // Ensure we can still access durable_name through the extended interface if needed,
  // or they can use the standard NATS property names.
}

export interface CronOptions {
  lockTtlMs?: number;
  tz?: string;
}

// --- Internal Metadata Structures ---
export interface NatsSubscriptionMeta {
  methodName: string;
  subject: string;
  schema: z.ZodTypeAny;
  responseSchema?: z.ZodTypeAny; // For requests
  options: NatsSubscriptionOptions;
  isRequest: boolean;
}

export interface NatsConcurrencyMeta {
  pattern: string;
  limit: number;
  ttlMs?: number;
}

export interface NatsCronMeta {
  methodName: string;
  name: string;
  schedule: string;
  options: CronOptions;
}

// --- Decorators ---

/**
 * Injects the NatsMQEngine instance into a class property.
 */
export function NatsClient(): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    Reflect.defineMetadata(NATSMQ_CLIENT_METADATA, true, target, propertyKey);
  };
}

/**
 * Subscribes a method to a NATS subject. 
 * Automatically validates incoming payloads using the provided Zod schema.
 */
export function OnNatsMessage<T extends z.ZodTypeAny>(
  subjectOrContract: string | NatsMessageContract<z.infer<T>>,
  schemaOrOptions?: T | NatsSubscriptionOptions,
  maybeOptions: NatsSubscriptionOptions = {}
) {
  return (target: object, propertyKey: any, descriptor?: any) => {
    let subject: string;
    let schema: z.ZodTypeAny;
    let options: NatsSubscriptionOptions;

    if (typeof subjectOrContract === "string") {
      subject = subjectOrContract;
      schema = schemaOrOptions as z.ZodTypeAny;
      options = maybeOptions;
    } else {
      // Contract mode
      subject = subjectOrContract.subject;
      schema = subjectOrContract.schema;
      options = { ...subjectOrContract.options, ...(schemaOrOptions as any) };
    }

    const existing: NatsSubscriptionMeta[] = Reflect.getMetadata(NATSMQ_SUBSCRIPTION_METADATA, target.constructor) || [];
    existing.push({
      methodName: propertyKey as string,
      subject,
      schema,
      options,
      isRequest: false
    });
    Reflect.defineMetadata(NATSMQ_SUBSCRIPTION_METADATA, existing, target.constructor);
  };
}

/**
 * Subscribes a method to a NATS subject expecting a request (Request-Reply pattern).
 * Validates both incoming request and the outgoing response.
 */
export function OnNatsRequest<TReq extends z.ZodTypeAny, TRes extends z.ZodTypeAny>(
  subject: string,
  reqSchema: TReq,
  resSchema: TRes,
  options: NatsSubscriptionOptions = {}
) {
  return (target: object, propertyKey: string | symbol, descriptor?: TypedPropertyDescriptor<any>) => {
    const existing: NatsSubscriptionMeta[] = Reflect.getMetadata(NATSMQ_SUBSCRIPTION_METADATA, target.constructor) || [];
    existing.push({
      methodName: propertyKey as string,
      subject,
      schema: reqSchema,
      responseSchema: resSchema,
      options,
      isRequest: true
    });
    Reflect.defineMetadata(NATSMQ_SUBSCRIPTION_METADATA, existing, target.constructor);
  };
}

/**
 * Limits concurrent processing of messages that match the subject pattern.
 * Uses the exact subject of the message as the lock key.
 */
export function MaxAckPendingPerSubject(pattern: string, limit: number) {
  return (target: object, propertyKey: any) => {
    const meta: NatsConcurrencyMeta = { pattern, limit };
    // We attach it directly to the method, since it modifies the specific handler's behavior
    Reflect.defineMetadata(NATSMQ_CONCURRENCY_METADATA, meta, target, propertyKey);
  };
}

/**
 * Schedules a method to run periodically via a distributed lock.
 * Ensures only one instance runs the cron across the cluster.
 */
export function OnCron(name: string, schedule: string, options: CronOptions = {}) {
  return (target: object, propertyKey: any) => {
    const existing: NatsCronMeta[] = Reflect.getMetadata(NATSMQ_CRON_METADATA, target.constructor) || [];
    existing.push({
      methodName: propertyKey as string,
      name,
      schedule,
      options
    });
    Reflect.defineMetadata(NATSMQ_CRON_METADATA, existing, target.constructor);
  };
}
