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
   */
  getNatsConfig() {
    return {
      subject: this.subject,
      schema: this.schema,
      options: this.options
    };
  }

  /**
   * Returns a new contract instance with dynamic subject parts filled.
   * Replaces '*' or '>' tokens with provided arguments.
   */
  fill(...args: string[]): NatsMessageContract<T, R> {
    let newSubject = this.subject;
    for (const arg of args) {
      newSubject = newSubject.replace(/(\*|>)/, arg);
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
    return {
      subject: this.prefix ? (this.prefix.endsWith('.') ? `${this.prefix}>` : `${this.prefix}.>`) : ">",
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
