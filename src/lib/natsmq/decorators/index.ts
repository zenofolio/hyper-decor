import "reflect-metadata";
import { z } from "zod";
import {
  NatsSubscriptionOptions,
  NatsSubscriptionMeta,
  NatsCronMeta,
  NatsConcurrencyMeta,
  INatsProvider,
  CronOptions,
  NatsMQMetadata,
  NatsMQAppOptions,
  IMessageContract
} from "../types";
import { getNatsMQMeta } from "../meta";

/**
 * Internal helper to generate a unique key for the metadata map.
 */
function generateMetaKey(targetName: string, propertyName: string): string {
  return `${targetName}:${propertyName}`;
}

/**
 * Class-level decorator to associate a worker with a specific Queue Factory (INatsProvider).
 */
export function NatsMQWorker(queue: INatsProvider<unknown>): ClassDecorator {
  return (target: any) => {
    // In Stage 3, target is the class. In Legacy, it's also the class.
    const meta = getNatsMQMeta(target);
    meta.workerOptions = { queue };
  };
}

/**
 * Top-level decorator to define the entry point of the NatsMQ application.
 */
export function NatsMQApp(options: NatsMQAppOptions): ClassDecorator {
  return (target: any) => {
    const meta = getNatsMQMeta(target);
    meta.appConfig = options;
  };
}

/**
 * Decorator to subscribe a method to a NATS subject or contract.
 */
export function OnNatsMessage(
  subjectOrAction: string | INatsProvider<unknown> | IMessageContract<unknown>,
  schemaOrOptions?: z.ZodType<unknown> | NatsSubscriptionOptions,
  maybeOptions?: NatsSubscriptionOptions
): any {
  return (target: any, propertyKey?: string | symbol, descriptor?: any) => {
    // Detect Stage 3 vs Legacy
    const isStage3 = typeof propertyKey === "object" && propertyKey !== null;
    let constructor: Function;
    let propertyName: string;

    if (isStage3) {
      // Stage 3: target is the method, propertyKey is the context
      const context = propertyKey as any;
      propertyName = String(context.name);
      // In Stage 3 method decorators, we can't easily get the constructor here.
      // We need to store it on the method itself and resolve it later, 
      // or use a different approach.
      // BUT for simplicity, if we are in Stage 3, we expect @NatsMQWorker on the class
      // which will initialize the class meta.
      // For now, let's try to use the method as a key or store in a global weakmap?
      // Actually, let's just use the method as the target for now and fix getNatsMQMeta.
      constructor = target;
    } else {
      // Legacy
      constructor = propertyKey === undefined ? (target as Function) : target.constructor as Function;
      propertyName = propertyKey === undefined ? "class_handler" : String(propertyKey);
    }

    const meta = getNatsMQMeta(constructor);

    let subject: string;
    let schema: z.ZodType<unknown>;
    let options: NatsSubscriptionOptions;

    if (typeof subjectOrAction === "string") {
      subject = subjectOrAction;
      schema = (schemaOrOptions instanceof z.ZodType) ? schemaOrOptions : z.any();
      options = (!(schemaOrOptions instanceof z.ZodType) ? schemaOrOptions : maybeOptions) || {};
    } else if ("getDefinition" in subjectOrAction) {
      // It's an IMessageContract
      const def = (subjectOrAction as IMessageContract<unknown>).getDefinition();
      subject = def.topic;
      schema = def.schema;
      options = { ...def.config, ...(schemaOrOptions as NatsSubscriptionOptions) };
    } else {
      // It's an INatsProvider (legacy)
      const config = (subjectOrAction as INatsProvider<unknown>).getNatsConfig();
      subject = config.subject;
      schema = config.schema;
      options = { ...config.options, ...(schemaOrOptions as NatsSubscriptionOptions) };
    }

    const key = generateMetaKey(constructor.name, propertyName);
    const existing = meta.subscriptions.get(key) || {
      key,
      methodName: propertyName,
      className: constructor.name,
      concurrencies: []
    };

    meta.subscriptions.set(key, {
      ...existing,
      subject,
      originalSubject: typeof subjectOrAction === "string" ? subjectOrAction : (subjectOrAction as any).subject,
      schema,
      options,
      isRequest: false
    } as NatsSubscriptionMeta);
  };
}

/**
 * Decorator to schedule a method as a cron job.
 */
export function OnCron(name: string, schedule: string, options?: CronOptions): any {
  return (target: any, propertyKey?: string | symbol, _descriptor?: any) => {
    // Detect Stage 3 vs Legacy
    const isStage3 = typeof propertyKey === "object" && propertyKey !== null;
    let constructor: Function;
    let propertyName: string;

    if (isStage3) {
      const context = propertyKey as any;
      propertyName = String(context.name);
      constructor = target;
    } else {
      constructor = propertyKey === undefined ? (target as Function) : target.constructor as Function;
      propertyName = propertyKey === undefined ? "class_cron" : String(propertyKey);
    }

    const { crons } = getNatsMQMeta(constructor);
    const key = generateMetaKey(constructor.name, propertyName);

    crons.set(key, {
      key,
      methodName: propertyName,
      className: constructor.name,
      schedule,
      name,
      options
    });
  };
}

/**
 * Utility to merge concurrency limits into a metadata object.
 */
function mergeConcurrencies(existing: NatsConcurrencyMeta[], pattern: string, limit: number, ttlMs?: number): NatsConcurrencyMeta[] {
  const result = [...existing];
  const idx = result.findIndex(c => c.pattern === pattern);
  if (idx >= 0) {
    result[idx] = { pattern, limit, ttlMs: ttlMs || result[idx].ttlMs };
  } else {
    result.push({ pattern, limit, ttlMs });
  }
  return result;
}

/**
 * Decorator to enforce concurrency limits on a message handler.
 */
export function MaxAckPendingPerSubject(
  patternOrContract: string | INatsProvider<unknown> | IMessageContract<unknown>,
  limit: number,
  ttlMs?: number
): any {
  return (target: any, propertyKey?: string | symbol) => {
    const isStage3 = typeof propertyKey === "object" && propertyKey !== null;
    let constructor: Function;
    let propertyName: string;

    if (isStage3) {
      const context = propertyKey as any;
      propertyName = String(context.name);
      constructor = target;
    } else {
      constructor = propertyKey === undefined ? (target as Function) : target.constructor as Function;
      propertyName = propertyKey === undefined ? "class_handler" : String(propertyKey);
    }

    const meta = getNatsMQMeta(constructor);

    let pattern: string;
    if (typeof patternOrContract === "string") {
      pattern = patternOrContract;
    } else if ("getDefinition" in patternOrContract) {
      pattern = (patternOrContract as IMessageContract<unknown>).getDefinition().topic;
    } else {
      pattern = (patternOrContract as INatsProvider<unknown>).getNatsConfig().subject;
    }

    const key = generateMetaKey(constructor.name, propertyName);
    const existing = meta.subscriptions.get(key) || {
      key,
      methodName: propertyName,
      className: constructor.name,
      concurrencies: [],
      subject: "",
      schema: z.any(),
      options: {},
      isRequest: false
    };

    meta.subscriptions.set(key, {
      ...existing,
      concurrencies: mergeConcurrencies(existing.concurrencies, pattern, limit, ttlMs)
    });
  };
}
