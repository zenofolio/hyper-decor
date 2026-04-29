import { IConcurrencyStore } from "../types";
import { ILock, LockOptions, LockAbortSignal, runUsing } from "../../lock/lock";

interface LockInfo {
  resources: string[];
  expiresAt: number;
  limit: number;
  value: string;
}

export class LocalConcurrencyStore implements IConcurrencyStore {
  private activeLocks = new Map<string, LockInfo>();
  private globalActiveCount = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;

  async onInit(): Promise<void> {
    this.cleanupInterval = setInterval(() => this.cleanup(), 5000);
  }

  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.activeLocks.clear();
    this.globalActiveCount = 0;
  }

  async acquire(resources: string[], duration: number, options: LockOptions = {}): Promise<ILock | null> {
    const now = Date.now();
    const limit = options.limit || 1;
    
    // Check if any pattern exceeds the limit
    for (const res of resources) {
      const currentCount = this.getActiveCountSync(res);
      if (currentCount >= limit) {
        return null;
      }
    }

    const value = Math.random().toString(36).substring(7);
    const expiresAt = now + duration;

    this.activeLocks.set(value, {
      resources,
      expiresAt,
      limit,
      value
    });

    this.globalActiveCount++;

    const lock: ILock = {
      resources,
      value,
      expiration: expiresAt,
      release: () => this.release(lock),
      extend: (d) => this.extend(lock, d)
    };
    
    return lock;
  }

  async release(lock: ILock, _options?: LockOptions): Promise<void> {
    if (this.activeLocks.has(lock.value)) {
      this.activeLocks.delete(lock.value);
      this.globalActiveCount = Math.max(0, this.globalActiveCount - 1);
    }
  }

  async extend(lock: ILock, duration: number, _options?: LockOptions): Promise<ILock> {
    const info = this.activeLocks.get(lock.value);
    if (!info) throw new Error("Lock not found or expired");
    
    info.expiresAt = Date.now() + duration;
    lock.expiration = info.expiresAt;
    return lock;
  }

  async using<T>(
    resources: string[],
    duration: number,
    settingsOrRoutine: LockOptions | ((signal: LockAbortSignal) => Promise<T>),
    optionalRoutine?: (signal: LockAbortSignal) => Promise<T>
  ): Promise<T> {
    return runUsing(this, resources, duration, settingsOrRoutine as any, optionalRoutine);
  }

  async getActiveCount(pattern: string): Promise<number> {
    return this.getActiveCountSync(pattern);
  }

  async getGlobalActiveCount(): Promise<number> {
    return this.globalActiveCount;
  }

  private getActiveCountSync(pattern: string): number {
    let count = 0;
    const now = Date.now();
    
    const entries = Array.from(this.activeLocks.entries());
    for (const [_, info] of entries) {
      if (info.expiresAt > now && info.resources.includes(pattern)) {
        count++;
      }
    }
    return count;
  }

  private cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.activeLocks.entries());
    for (const [id, info] of entries) {
      if (info.expiresAt <= now) {
        this.activeLocks.delete(id);
        this.globalActiveCount = Math.max(0, this.globalActiveCount - 1);
      }
    }
  }
}
