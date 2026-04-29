import { z } from "zod";
import { NatsSubscriptionOptions, INatsProvider } from "../types";

export class NatsMessageContract<T, R = void> implements INatsProvider<T> {
  constructor(
    public readonly subject: string,
    public readonly schema: z.ZodType<T>,
    public readonly responseSchema?: z.ZodType<R>,
    public readonly options: NatsSubscriptionOptions = {}
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
   * Applies custom NATS consumer options and returns a NEW instance.
   */
  withOptions(options: Partial<NatsSubscriptionOptions>): NatsMessageContract<T, R> {
    return new NatsMessageContract(this.subject, this.schema, this.responseSchema, {
      ...this.options,
      ...options
    });
  }

  /**
   * Sets the maximum number of messages that can be pending ACK (inflight).
   * In NATS JetStream this maps to 'max_ack_pending'.
   */
  withMaxInflight(limit: number): NatsMessageContract<T, R> {
    return this.withOptions({ max_ack_pending: limit });
  }

  /**
   * Sets the maximum number of delivery attempts for a message.
   */
  withMaxDeliver(attempts: number): NatsMessageContract<T, R> {
    return this.withOptions({ max_deliver: attempts });
  }

  /**
   * Assigns this contract to a specific NATS JetStream.
   */
  withStream(name: string): NatsMessageContract<T, R> {
    return this.withOptions({ stream: name });
  }

  /**
   * Sets a durable name for the consumer associated with this contract.
   */
  withDurable(name: string): NatsMessageContract<T, R> {
    return this.withOptions({ durable_name: name });
  }

  /**
   * Adds a concurrency limit to this contract.
   */
  withConcurrency(pattern: string, limit: number, ttlMs?: number): NatsMessageContract<T, R> {
    const concurrencies = [...(this.options.concurrencies || [])];
    const index = concurrencies.findIndex(c => c.pattern === pattern);
    
    if (index !== -1) {
      concurrencies[index] = { ...concurrencies[index], limit, ttlMs };
    } else {
      concurrencies.push({ pattern, limit, ttlMs });
    }

    return this.withOptions({ concurrencies });
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
