import "reflect-metadata";
import { z } from "zod";

// --- Metadata Keys ---
export const NATSMQ_CLIENT_METADATA = Symbol("NATSMQ_CLIENT_METADATA");
export const NATSMQ_SUBSCRIPTION_METADATA = Symbol("NATSMQ_SUBSCRIPTION_METADATA");
export const NATSMQ_CONCURRENCY_METADATA = Symbol("NATSMQ_CONCURRENCY_METADATA");
export const NATSMQ_CRON_METADATA = Symbol("NATSMQ_CRON_METADATA");

// --- Options Interfaces ---
export interface NatsSubscriptionOptions {
  stream?: string;
  durable?: string;
  deliverPolicy?: "All" | "New" | "Last";
  ackWaitMs?: number;
  maxRetries?: number;
}

export interface CronOptions {
  name: string;
  lockTtlMs?: number;
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
}

export interface NatsCronMeta {
  methodName: string;
  schedule: string;
  options: CronOptions;
}

// --- Decorators ---

/**
 * Injects the NatsMQEngine instance into a class property.
 */
export function NatsClient(): PropertyDecorator {
  return (target: Object, propertyKey: string | symbol) => {
    Reflect.defineMetadata(NATSMQ_CLIENT_METADATA, true, target, propertyKey);
  };
}

/**
 * Subscribes a method to a NATS subject. 
 * Automatically validates incoming payloads using the provided Zod schema.
 */
export function OnNatsMessage<T extends z.ZodTypeAny>(
  subject: string,
  schema: T,
  options: NatsSubscriptionOptions = {}
): MethodDecorator {
  return (target: Object, propertyKey: string | symbol) => {
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
): MethodDecorator {
  return (target: Object, propertyKey: string | symbol) => {
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
export function MaxAckPendingPerSubject(pattern: string, limit: number): MethodDecorator {
  return (target: Object, propertyKey: string | symbol) => {
    const meta: NatsConcurrencyMeta = { pattern, limit };
    // We attach it directly to the method, since it modifies the specific handler's behavior
    Reflect.defineMetadata(NATSMQ_CONCURRENCY_METADATA, meta, target, propertyKey);
  };
}

/**
 * Schedules a method to run periodically via a distributed lock.
 * Ensures only one instance runs the cron across the cluster.
 */
export function OnCron(schedule: string, options: CronOptions): MethodDecorator {
  return (target: Object, propertyKey: string | symbol) => {
    const existing: NatsCronMeta[] = Reflect.getMetadata(NATSMQ_CRON_METADATA, target.constructor) || [];
    existing.push({
      methodName: propertyKey as string,
      schedule,
      options
    });
    Reflect.defineMetadata(NATSMQ_CRON_METADATA, existing, target.constructor);
  };
}
