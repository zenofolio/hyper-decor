import { z } from "zod";
import { NatsSubscriptionMeta, NatsSubscriptionOptions } from "../decorators";

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
   * Uses the prefix followed by '.>' to listen to all sub-subjects.
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
   * @param subject The sub-subject (will be prefixed if a prefix exists).
   * @param schema Zod schema for validation.
   * @param responseSchema Optional Zod schema for the response (Request-Reply).
   * @param options Specific NATS options for this message.
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
 * @param prefix Optional prefix for all subjects defined by this factory.
 * @param options Default options for all messages.
 */
export function defineQueue(prefix: string = "", options: NatsSubscriptionOptions = {}) {
  return new ContractFactory(prefix, options);
}
