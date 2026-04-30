import { z } from "zod";
import type { ConsumerConfig, RetentionPolicy, StorageType } from "nats";
import { ILock, ILockManager, LockOptions } from "../lock/lock";

// --- NATS Configuration & Provider ---

export interface NatsSubscriptionOptions extends Partial<ConsumerConfig> {
  stream?: string;
  concurrencies?: NatsConcurrencyMeta[];
  /**
   * Maximum number of messages to pull in a single batch.
   * Defaults to 50 or max_ack_pending if smaller.
   */
  max_messages?: number;
  storage?: StorageType
  retention?: RetentionPolicy
}

/**
 * Interface that allows a class to provide NATS configuration.
 * Can be implemented by individual messages or entire queue factories.
 */
export interface INatsProvider<T = any> {
  getNatsConfig(): {
    subject: string;
    schema: z.ZodType<T>;
    options: NatsSubscriptionOptions;
  };
}

// --- Metadata Structures ---

export interface NatsSubscriptionMeta {
  key: string; // "ClassName:methodName"
  methodName: string;
  className: string;
  subject: string;
  originalSubject?: string;
  schema: z.ZodTypeAny;
  responseSchema?: z.ZodTypeAny;
  options: NatsSubscriptionOptions;
  isRequest: boolean;
  concurrencies: NatsConcurrencyMeta[];
}

export interface NatsConcurrencyMeta {
  pattern: string;
  limit: number;
  ttlMs?: number;
}

export interface CronOptions {
  lockTtlMs?: number;
  tz?: string;
}

export interface NatsCronMeta {
  key: string; // "ClassName:methodName"
  methodName: string;
  className: string;
  name: string;
  schedule: string;
  options?: CronOptions;
}

export interface NatsMQWorkerOptions {
  queue?: INatsProvider<unknown>;
}

export interface NatsMQAppOptions {
  servers?: string | string[];
  workers?: Array<new (...args: unknown[]) => unknown>;
  queues?: INatsProvider<unknown>[];
}

export interface NatsMQMetadata {
  subscriptions: Map<string, NatsSubscriptionMeta>;
  crons: Map<string, NatsCronMeta>;
  workerOptions?: NatsMQWorkerOptions;
  appConfig?: NatsMQAppOptions;
}

// --- Engine & Store Interfaces ---

export interface IConcurrencyStore extends ILockManager {
  onInit?(): Promise<void>;
  close?(): Promise<void>;
  acquire(resources: string[], duration: number, options?: LockOptions): Promise<ILock | null>;
  release(lock: ILock, options?: LockOptions): Promise<any>;
  extend(lock: ILock, duration: number, options?: LockOptions): Promise<ILock>;
  getGlobalActiveCount(): Promise<number>;
  getActiveCount(subject: string): Promise<number>;
}

export interface INatsMetrics {
  recordMessageReceived(subject: string): void | Promise<void>;
  recordProcessingSuccess(subject: string, durationMs: number): void | Promise<void>;
  recordProcessingError(subject: string, type: string): void | Promise<void>;
  recordCronError(name: string, error: string): void | Promise<void>;
  increment(name: string, value?: number, labels?: Record<string, string>): void | Promise<void>;
  gauge(name: string, value: number, labels?: Record<string, string>): void | Promise<void>;
  getCounter(type: 'received' | 'success' | 'error', subject?: string | INatsProvider<any>): Promise<number>;
  getAverageLatency(subject: string | INatsProvider<any>): Promise<number>;
}

export type NatsMQMetrics = INatsMetrics;

export interface NatsMQOptions {
  servers: string | string[];
  dlsSubject?: string;
  metrics?: INatsMetrics;
  concurrencyStore?: IConcurrencyStore;
  defaultTtlMs?: number;
  retryBackoffMs?: number[];
}

export interface CronContext {
  readonly name: string;
  readonly scheduledTime: Date;
  readonly actualTime: Date;
  readonly executionId: string;
  extendLock(ms: number): Promise<void>;
  log(message: string): void;
  readonly metrics: NatsMQMetrics;
}
