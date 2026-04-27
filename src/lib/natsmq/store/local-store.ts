import { IConcurrencyStore } from "../types";

export class LocalConcurrencyStore implements IConcurrencyStore {
  // Map of subject -> array of active execution timestamps
  private activeLocks = new Map<string, number[]>();
  private globalCount = 0;

  async acquire(subject: string, limit: number, ttlMs: number): Promise<boolean> {
    const now = Date.now();
    this.cleanupExpired(now);

    let locks = this.activeLocks.get(subject) || [];
    
    if (locks.length >= limit) {
      return false; // Limit reached
    }

    locks.push(now + ttlMs);
    this.activeLocks.set(subject, locks);
    this.globalCount++;
    return true;
  }

  async release(subject: string): Promise<void> {
    const locks = this.activeLocks.get(subject);
    if (!locks || locks.length === 0) {
      return;
    }

    // Remove the oldest lock
    locks.shift();
    if (locks.length === 0) {
      this.activeLocks.delete(subject);
    } else {
      this.activeLocks.set(subject, locks);
    }
    
    this.globalCount = Math.max(0, this.globalCount - 1);
  }

  async getGlobalActiveCount(): Promise<number> {
    this.cleanupExpired(Date.now());
    return this.globalCount;
  }

  async getActiveCount(subject: string): Promise<number> {
    this.cleanupExpired(Date.now());
    const locks = this.activeLocks.get(subject);
    return locks ? locks.length : 0;
  }

  private cleanupExpired(now: number) {
    let newGlobalCount = 0;
    
    for (const [subject, locks] of this.activeLocks.entries()) {
      const validLocks = locks.filter(expiry => expiry > now);
      
      if (validLocks.length === 0) {
        this.activeLocks.delete(subject);
      } else if (validLocks.length !== locks.length) {
        this.activeLocks.set(subject, validLocks);
        newGlobalCount += validLocks.length;
      } else {
        newGlobalCount += validLocks.length;
      }
    }
    
    this.globalCount = newGlobalCount;
  }
}
