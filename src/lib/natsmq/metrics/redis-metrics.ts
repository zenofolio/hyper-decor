import { Redis } from "ioredis";
import { INatsMetrics, NatsMQMetrics } from "../types";

export interface RedisMetricsOptions {
  redis: Redis;
  prefix?: string;
}

export class RedisMetrics implements INatsMetrics {
  private redis: Redis;
  private prefix: string;

  constructor(options: RedisMetricsOptions) {
    this.redis = options.redis;
    this.prefix = options.prefix || "natsmq:metrics";
  }

  // --- INatsMetrics Implementation (Engine) ---

  async recordMessageReceived(subject: string): Promise<void> {
    await this.redis.hincrby(`${this.prefix}:received`, subject, 1);
  }

  async recordProcessingSuccess(subject: string, durationMs: number): Promise<void> {
    await this.redis.hincrby(`${this.prefix}:success`, subject, 1);
    await this.redis.hincrby(`${this.prefix}:latency:total`, subject, durationMs);
  }

  async recordProcessingError(subject: string, type: string): Promise<void> {
    await this.redis.hincrby(`${this.prefix}:error:${type}`, subject, 1);
    await this.redis.hincrby(`${this.prefix}:error`, subject, 1);
  }

  async recordCronError(name: string, error: string): Promise<void> {
    await this.redis.hincrby(`${this.prefix}:cron:errors`, name, 1);
  }

  async getCounter(subject: string, type: 'received' | 'success' | 'error'): Promise<number> {
    const val = await this.redis.hget(`${this.prefix}:${type}`, subject);
    return parseInt(val || "0");
  }

  async getAverageLatency(subject: string): Promise<number> {
    const total = await this.redis.hget(`${this.prefix}:latency:total`, subject);
    const count = await this.redis.hget(`${this.prefix}:success`, subject);
    
    const t = parseInt(total || "0");
    const c = parseInt(count || "0");
    
    return c === 0 ? 0 : t / c;
  }

  // --- NatsMQMetrics Implementation (Cron/General) ---

  async increment(name: string, value: number = 1, labels?: Record<string, string>): Promise<void> {
    const key = this.serializeKey(name, labels);
    await this.redis.hincrby(`${this.prefix}:counters`, key, value);
  }

  async gauge(name: string, value: number, labels?: Record<string, string>): Promise<void> {
    const key = this.serializeKey(name, labels);
    await this.redis.hset(`${this.prefix}:gauges`, key, value.toString());
  }

  // --- Utilities ---

  private serializeKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const sortedLabels = Object.keys(labels).sort().map(k => `${k}=${labels[k]}`).join(',');
    return `${name}{${sortedLabels}}`;
  }

  async getSnapshot(): Promise<{ counters: Record<string, string>, gauges: Record<string, string> }> {
    const [counters, gauges] = await Promise.all([
      this.redis.hgetall(`${this.prefix}:counters`),
      this.redis.hgetall(`${this.prefix}:gauges`)
    ]);
    return { counters, gauges };
  }
}
