import { Redis } from "ioredis";
import { IConcurrencyStore } from "../types";
import { randomUUID } from "crypto";
import { ILock, LockAbortSignal, runUsing, LockOptions } from "../../lock/lock";

export interface RedisConcurrencyStoreOptions {
  redis: Redis;
  prefix?: string;
}

/**
 * Extended Redis interface to support custom Lua commands.
 */
interface NatsMQRedis extends Redis {
  natsmq_acquire(key: string, limit: number, ttl: number, lockId: string): Promise<number>;
  natsmq_release(key: string, lockId: string): Promise<number>;
}

class RedisLock implements ILock {
  constructor(
    private store: RedisConcurrencyStore,
    public readonly resources: string[],
    public readonly value: string,
    public expiration: number
  ) { }

  async release(): Promise<void> {
    await this.store.release(this);
  }

  async extend(duration: number): Promise<ILock> {
    return this.store.extend(this, duration);
  }
}

export class RedisConcurrencyStore implements IConcurrencyStore {
  private redis: NatsMQRedis;
  private prefix: string;

  constructor(options: RedisConcurrencyStoreOptions) {
    this.redis = options.redis as NatsMQRedis;
    this.prefix = options.prefix || "natsmq:concurrency";
    this.setupScripts();
  }

  private setupScripts() {
    this.redis.defineCommand("natsmq_acquire", {
      numberOfKeys: 1,
      lua: `
        local zset_key = KEYS[1]
        local limit = tonumber(ARGV[1])
        local ttl_ms = tonumber(ARGV[2])
        local lock_id = ARGV[3]
        local time = redis.call('TIME')
        local now_ms = (tonumber(time[1]) * 1000) + math.floor(tonumber(time[2]) / 1000)
        redis.call('ZREMRANGEBYSCORE', zset_key, '-inf', now_ms)
        if redis.call('ZCARD', zset_key) >= limit then return 0 end
        redis.call('ZADD', zset_key, now_ms + ttl_ms, lock_id)
        return 1
      `
    });

    this.redis.defineCommand("natsmq_release", {
      numberOfKeys: 1,
      lua: `return redis.call('ZREM', KEYS[1], ARGV[1])`
    });
  }

  private getRedisKey(subject: string): string {
    return `${this.prefix}:${subject}`;
  }

  async acquire(resources: string[], duration: number, options?: LockOptions): Promise<ILock | null> {
    const subject = resources[0];
    const limit = options?.limit || 1;
    const key = this.getRedisKey(subject);
    const lockId = randomUUID();
    const result = await this.redis.natsmq_acquire(key, limit, duration, lockId);
    if (result === 1) {
      return new RedisLock(this, [subject], lockId, Date.now() + duration);
    }
    return null;
  }

  async release(lock: ILock, _options?: LockOptions): Promise<void> {
    await this.redis.natsmq_release(this.getRedisKey(lock.resources[0]), lock.value);
  }

  async extend(lock: ILock, duration: number, _options?: LockOptions): Promise<ILock> {
    const key = this.getRedisKey(lock.resources[0]);
    const success = await this.redis.natsmq_acquire(key, 999999, duration, lock.value);
    if (!success) throw new Error("Could not extend lock");
    lock.expiration = Date.now() + duration;
    return lock;
  }

  using<T>(resources: string[], duration: number, routine: (signal: LockAbortSignal) => Promise<T>): Promise<T>;
  using<T>(resources: string[], duration: number, settings: LockOptions, routine: (signal: LockAbortSignal) => Promise<T>): Promise<T>;
  async using<T>(
    resources: string[],
    duration: number,
    routineOrSettings: LockOptions | ((signal: LockAbortSignal) => Promise<T>),
    routine?: (signal: LockAbortSignal) => Promise<T>
  ): Promise<T> {
    return runUsing(this, resources, duration, routineOrSettings, routine);
  }

  async getGlobalActiveCount(): Promise<number> {
    const keys = await this.redis.keys(`${this.prefix}:*`);
    let total = 0;
    for (const key of keys) total += await this.redis.zcard(key);
    return total;
  }

  async getActiveCount(subject: string): Promise<number> {
    return await this.redis.zcard(this.getRedisKey(subject));
  }
}
