export interface IConcurrencyStore {
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
   * If the limit is reached, returns false.
   * 
   * @param subject The exact subject string.
   * @param limit The maximum number of concurrent executions allowed.
   * @param ttlMs The maximum time the lock should be held (safety net for crashes).
   */
  acquire(subject: string, limit: number, ttlMs: number): Promise<boolean>;

  /**
   * Releases a slot for the given subject.
   * 
   * @param subject The exact subject string.
   */
  release(subject: string): Promise<void>;

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

export interface NatsMQOptions {
  /**
   * NATS cluster addresses.
   * Example: "nats://localhost:4222"
   */
  servers: string | string[];

  /**
   * Enable internal Prometheus-style metrics collection.
   * Default: false
   */
  metricsEnabled?: boolean;

  /**
   * The subject where messages that fail Zod validation will be sent.
   * If not provided, invalid messages will be terminated (ACKed without processing) 
   * and logged as errors, but not sent to a DLS.
   */
  dlsSubject?: string;

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

export interface NatsMQMetrics {
  increment(name: string, value?: number, labels?: Record<string, string>): void;
  gauge(name: string, value: number, labels?: Record<string, string>): void;
  // Further metric methods can be added here
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
