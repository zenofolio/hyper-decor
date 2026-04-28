import { ILock, LockAbortSignal, runUsing, LockOptions } from "../../lock/lock";
import { IConcurrencyStore } from "../types";

interface LockInfo {
  subject: string;
  expiry: number;
}

class LocalLock implements ILock {
  constructor(
    private store: LocalConcurrencyStore,
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

export class LocalConcurrencyStore implements IConcurrencyStore {
  private counters = new Map<string, Set<string>>();
  private locks = new Map<string, LockInfo>();

  async onInit(): Promise<void> { }

  constructor() {
    setInterval(() => this.cleanup(), 100).unref();
  }

  async acquire(resources: string[], duration: number, options?: LockOptions): Promise<ILock | null> {
    const subject = resources[0];
    const limit = options?.limit || 1;

    let current = this.counters.get(subject);
    if (!current) {
      current = new Set();
      this.counters.set(subject, current);
    }
    
    if (current.size >= limit) return null;

    const lockId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    current.add(lockId);
    
    const expiration = Date.now() + duration;
    this.locks.set(lockId, { subject, expiry: expiration });

    return new LocalLock(this, [subject], lockId, expiration);
  }

  async release(lock: ILock, _options?: LockOptions): Promise<void> {
    const lockId = lock.value;
    const info = this.locks.get(lockId);
    if (info) {
      const subject = info.subject;
      const current = this.counters.get(subject);
      if (current) {
        current.delete(lockId);
        if (current.size === 0) this.counters.delete(subject);
      }
      this.locks.delete(lockId);
    }
  }

  async extend(lock: ILock, duration: number, _options?: LockOptions): Promise<ILock> {
    const info = this.locks.get(lock.value);
    if (!info) throw new Error("Lock not found");
    info.expiry += duration;
    lock.expiration = info.expiry;
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

  private cleanup() {
    const now = Date.now();
    for (const [lockId, info] of this.locks.entries()) {
      if (info.expiry < now) {
        const subject = info.subject;
        const current = this.counters.get(subject);
        if (current) {
          current.delete(lockId);
          if (current.size === 0) this.counters.delete(subject);
        }
        this.locks.delete(lockId);
      }
    }
  }

  async getGlobalActiveCount(): Promise<number> {
    return Array.from(this.counters.values()).reduce((acc, set) => acc + set.size, 0);
  }

  async close(): Promise<void> {
    this.counters.clear();
    this.locks.clear();
  }

  async getActiveCount(subject: string): Promise<number> {
    return this.counters.get(subject)?.size || 0;
  }
}
