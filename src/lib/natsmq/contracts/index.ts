import { z } from "zod";
import { NatsSubscriptionMeta, NatsSubscriptionOptions } from "../decorators";

export class NatsMessageContract<T, R = void> {
  constructor(
    public readonly subject: string,
    public readonly schema: z.ZodType<T>,
    public readonly responseSchema?: z.ZodType<R>,
    public options: NatsSubscriptionOptions = {}
  ) {}

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

export class ContractFactory {
  constructor(
    private readonly prefix: string = "",
    private readonly baseOptions: NatsSubscriptionOptions = {}
  ) { }

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
