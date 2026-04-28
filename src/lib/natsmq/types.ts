import { ILock, ILockManager, LockAbortSignal, LockOptions } from "../lock/lock";

export interface IConcurrencyStore extends ILockManager {
  /**
   * Optional initialization (e.g., connecting to Redis).
   */
  onInit?(): Promise<void>;

  /**
   * Clean up resources (e.g., disconnect from Redis).
   */
  close?(): Promise<void>;

  /**
   * Attempts to acquire a slot for the given subject.
   * If the limit is reached, returns null.
   * 
   * @param resources In this context, the first resource is the subject string.
   * @param duration The maximum time the lock should be held.
   * @param options Should contain 'limit' for concurrency control.
   * @returns The ILock instance if acquired, or null if the limit was reached.
   */
  acquire(resources: string[], duration: number, options?: LockOptions): Promise<ILock | null>;

  /**
   * Releases an existing lock.
   */
  release(lock: ILock, options?: LockOptions): Promise<any>;

  /**
   * Extends an existing lock.
   */
  extend(lock: ILock, duration: number, options?: LockOptions): Promise<ILock>;

  /**
   * Returns the total number of currently active locks across all subjects.
   * Used for global observability.
   */
  getGlobalActiveCount(): Promise<number>;

  /**
   * Returns the current number of active locks for a specific subject.
   */
  getActiveCount(subject: string): Promise<number>;
}

export interface INatsMetrics {
  recordMessageReceived(subject: string): void | Promise<void>;
  recordProcessingSuccess(subject: string, durationMs: number): void | Promise<void>;
  recordProcessingError(subject: string, type: string): void | Promise<void>;
  recordCronError(name: string, error: string): void | Promise<void>;

  /**
   * General purpose increment.
   */
  increment(name: string, value?: number, labels?: Record<string, string>): void | Promise<void>;

  /**
   * General purpose gauge.
   */
  gauge(name: string, value: number, labels?: Record<string, string>): void | Promise<void>;

  /**
   * Inspection: get the current value of a counter.
   * If subject is not provided, returns the total across all subjects.
   */
  getCounter(type: 'received' | 'success' | 'error', subject?: string): Promise<number>;

  /**
   * Inspection: get the average latency for a subject.
   */
  getAverageLatency(subject: string): Promise<number>;
}

export type NatsMQMetrics = INatsMetrics;

export interface NatsMQOptions {
  /**
   * NATS cluster addresses.
   * Example: "nats://localhost:4222"
   */
  servers: string | string[];

  /**
   * The subject where messages that fail Zod validation will be sent.
   * If not provided, invalid messages will be terminated (ACKed without processing) 
   * and logged as errors, but not sent to a DLS.
   */
  dlsSubject?: string;

  /**
   * External metrics collector.
   */
  metrics?: INatsMetrics;

  /**
   * The store used for subject-based concurrency (@MaxAckPendingPerSubject) and Cron locks.
   * If not provided, a Local (in-memory) store will be used.
   */
  concurrencyStore?: IConcurrencyStore;

  /**
   * Default safety TTL for subject locks in milliseconds.
   * Default: 30000 (30 seconds)
   */
  defaultTtlMs?: number;

  /**
   * Backoff strategy for successive 'nak' calls when the concurrency limit is reached.
   * Array of delays in milliseconds. The last element is used indefinitely once reached.
   * Default: [1000, 2000, 5000]
   */
  retryBackoffMs?: number[];
}

export interface CronContext {
  /**
   * The unique name of the cron task.
   */
  readonly name: string;

  /**
   * The time this cron was scheduled to run.
   */
  readonly scheduledTime: Date;

  /**
   * The actual time execution started.
   */
  readonly actualTime: Date;

  /**
   * Unique ID for this specific execution attempt.
   */
  readonly executionId: string;

  /**
   * Extends the distributed lock TTL for this cron execution.
   * Useful for long-running tasks.
   * @param ms Additional time in milliseconds to hold the lock.
   */
  extendLock(ms: number): Promise<void>;

  /**
   * Logs a message associated with this specific cron execution.
   */
  log(message: string): void;

  /**
   * Access the metrics engine.
   */
  readonly metrics: NatsMQMetrics;
}
