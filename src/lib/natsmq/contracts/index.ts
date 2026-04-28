import { z } from "zod";
import { NatsSubscriptionMeta } from "../decorators";

export interface NatsMessageContract<T> {
  subject: string;
  schema: z.ZodType<T>;
  options?: Partial<NatsSubscriptionMeta['options']>;
}

export class ContractFactory {
  constructor(
    private readonly prefix: string = "",
    private readonly baseOptions: Partial<NatsSubscriptionMeta['options']> = {}
  ) { }

  /**
   * Defines a new message contract.
   * @param subject The sub-subject (will be prefixed if a prefix exists).
   * @param schema Zod schema for validation.
   * @param options Specific NATS options for this message.
   */
  define<T>(
    subject: string,
    schema: z.ZodType<T>,
    options: Partial<NatsSubscriptionMeta['options']> = {}
  ): NatsMessageContract<T> {
    const fullSubject = this.prefix 
      ? (this.prefix.endsWith('.') || subject.startsWith('.') ? `${this.prefix}${subject}` : `${this.prefix}.${subject}`)
      : subject;

    return {
      subject: fullSubject,
      schema,
      options: { ...this.baseOptions, ...options }
    };
  }
}

/**
 * Creates a new contract factory.
 * @param prefix Optional prefix for all subjects defined by this factory.
 * @param options Default options for all messages.
 */
export function defineQueue(prefix: string = "", options: Partial<NatsSubscriptionMeta['options']> = {}) {
  return new ContractFactory(prefix, options);
}
