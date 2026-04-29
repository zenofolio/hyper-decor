import { z } from "zod";
import { NatsSubscriptionOptions, INatsProvider } from "../types";

export class NatsMessageContract<T, R = void> implements INatsProvider<T> {
  constructor(
    public readonly subject: string,
    public readonly schema: z.ZodType<T>,
    public readonly responseSchema?: z.ZodType<R>,
    public options: NatsSubscriptionOptions = {}
  ) {}

  /**
   * Implements INatsProvider to return the contract's specific configuration.
   * Converts named parameters (:key) to NATS wildcards (*) for subscriptions.
   */
  getNatsConfig() {
    return {
      subject: this.subject.replace(/:[a-zA-Z0-9]+/g, "*"),
      schema: this.schema,
      options: this.options
    };
  }

  /**
   * Returns a new contract instance with dynamic subject parts filled.
   * If an object is provided, replaces ':key' tokens with values.
   * If strings are provided, replaces '*' or '>' tokens sequentially.
   */
  fill(params: Record<string, string> | string, ...args: string[]): NatsMessageContract<T, R> {
    let newSubject = this.subject;

    if (typeof params === "object" && params !== null) {
      for (const [key, value] of Object.entries(params)) {
        newSubject = newSubject.replace(`:${key}`, value);
      }
    } else if (typeof params === "string") {
      const allArgs = [params, ...args];
      for (const arg of allArgs) {
        newSubject = newSubject.replace(/(\*|>)/, arg);
      }
    }

    return new NatsMessageContract(newSubject, this.schema, this.responseSchema, this.options);
  }

  /**
   * Assigns this contract to a specific NATS JetStream.
   */
  withStream(name: string): this {
    this.options.stream = name;
    return this;
  }

  /**
   * Sets a durable name for the consumer associated with this contract.
   */
  withDurable(name: string): this {
    this.options.durable_name = name;
    return this;
  }

  /**
   * Sets the maximum number of redelivery attempts.
   */
  withMaxDeliver(count: number): this {
    this.options.max_deliver = count;
    return this;
  }

  /**
   * Adds a concurrency limit to this contract.
   */
  withConcurrency(pattern: string, limit: number, ttlMs?: number): this {
    this.options.concurrencies ??= [];
    const existing = this.options.concurrencies.find(c => c.pattern === pattern);
    if (existing) {
      existing.limit = limit;
      if (ttlMs) existing.ttlMs = ttlMs;
    } else {
      this.options.concurrencies.push({ pattern, limit, ttlMs });
    }
    return this;
  }

  /**
   * Adds any custom NATS subscription options.
   */
  withOptions(options: NatsSubscriptionOptions): this {
    this.options = { ...this.options, ...options };
    return this;
  }
}

export class ContractFactory implements INatsProvider<any> {
  constructor(
    public readonly prefix: string = "",
    public readonly baseOptions: NatsSubscriptionOptions = {}
  ) { }

  /**
   * Implements INatsProvider to return a "catch-all" configuration for the entire queue.
   */
  getNatsConfig() {
    const base = this.prefix ? (this.prefix.endsWith('.') ? `${this.prefix}>` : `${this.prefix}.>`) : ">";
    return {
      subject: base.replace(/:[a-zA-Z0-9]+/g, "*"),
      schema: z.any(),
      options: this.baseOptions
    };
  }

  /**
   * Defines a new message contract.
   */
  define<T, R = void>(
    subject: string,
    schema: z.ZodType<T>,
    responseSchema?: z.ZodType<R>,
    options: NatsSubscriptionOptions = {}
  ): NatsMessageContract<T, R> {
    const fullSubject = this.prefix 
      ? (this.prefix.endsWith('.') || subject.startsWith('.') ? `${this.prefix}${subject}` : `${this.prefix}.${subject}`)
      : subject;

    return new NatsMessageContract(
      fullSubject,
      schema,
      responseSchema,
      { ...this.baseOptions, ...options }
    );
  }
}

/**
 * Creates a new contract factory.
 */
export function defineQueue(prefix: string = "", options: NatsSubscriptionOptions = {}) {
  return new ContractFactory(prefix, options);
}
