import { injectable, inject } from "tsyringe";
import { IMessageInterceptor, IMessageEnvelope, IMessageOptions, IMessageEmitOptions } from "../../../common/transport";
import { IIdempotencyStore } from "../../../common/idempotency";

/**
 * 🛡️ IdempotencyInterceptor
 * Prevents processing duplicate messages using a unique identity.
 */
@injectable()
export class IdempotencyInterceptor implements IMessageInterceptor {
  constructor(
    @inject("IIdempotencyStore") private store: IIdempotencyStore,
    @inject("IdempotencyConfig") private globalConfig: { enabled?: boolean, ttl?: number }
  ) { }

  /**
   * On Emit: Allows setting a custom idempotency key as the message ID.
   */
  async onEmit(topic: string, envelope: IMessageEnvelope, options: IMessageEmitOptions): Promise<void> {
    if (options.idempotencyKey) {
      envelope.i = options.idempotencyKey;
    }
  }

  /**
   * On Receive: Checks if the message ID has already been processed.
   */
  async onReceive(topic: string, envelope: IMessageEnvelope, options: IMessageOptions): Promise<boolean> {
    const idempotency = options.idempotency;

    // Skip if idempotency is explicitly disabled for this subscription
    if (idempotency === false) return true;

    // Check the store using a compound key (MessageID + SubscriptionID)
    // This allows multiple listeners in the same process to each receive the message once.
    const storageKey = `${envelope.i}:${options.subscriptionId}`;
    const alreadyProcessed = await this.store.has(storageKey);
    if (alreadyProcessed) {
      return false; // Cancel delivery
    }

    // Determine TTL: 1. Option TTL, 2. Global TTL, 3. Default (5 min)
    let ttl = 300000;
    if (typeof idempotency === 'object' && idempotency.ttl) {
      ttl = idempotency.ttl;
    } else if (this.globalConfig?.ttl) {
      ttl = this.globalConfig.ttl;
    }

    await this.store.set(storageKey, ttl);

    return true;
  }
}
