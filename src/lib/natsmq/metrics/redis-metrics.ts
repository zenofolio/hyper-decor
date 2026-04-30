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

  async getCounter(type: 'received' | 'success' | 'error', subject?: string | INatsProvider<any>): Promise<number> {
    const target = this.resolveSubject(subject);
    
    if (!target || target === ">") {
      // No subject or global wildcard: sum all fields in the hash
      const vals = await this.redis.hvals(`${this.prefix}:${type}`);
      return vals.reduce((acc, v) => acc + parseInt(v || "0"), 0);
    }

    if (target.endsWith(">") || target.endsWith("*")) {
      const prefix = target.slice(0, -1);
      const all = await this.redis.hgetall(`${this.prefix}:${type}`);
      return Object.keys(all)
        .filter(k => k.startsWith(prefix))
        .reduce((acc, k) => acc + parseInt(all[k] || "0"), 0);
    }

    const val = await this.redis.hget(`${this.prefix}:${type}`, target);
    return parseInt(val || "0");
  }

  async getAverageLatency(subject: string | INatsProvider<any>): Promise<number> {
    const target = this.resolveSubject(subject);
    if (!target) return 0;

    let total = 0;
    let count = 0;

    if (target.endsWith(">") || target.endsWith("*")) {
      const prefix = target.slice(0, -1);
      const [allTotal, allCount] = await Promise.all([
        this.redis.hgetall(`${this.prefix}:latency:total`),
        this.redis.hgetall(`${this.prefix}:success`)
      ]);

      Object.keys(allCount)
        .filter(k => k.startsWith(prefix))
        .forEach(k => {
          total += parseInt(allTotal[k] || "0");
          count += parseInt(allCount[k] || "0");
        });
    } else {
      const [t, c] = await Promise.all([
        this.redis.hget(`${this.prefix}:latency:total`, target),
        this.redis.hget(`${this.prefix}:success`, target)
      ]);
      total = parseInt(t || "0");
      count = parseInt(c || "0");
    }
    
    return count === 0 ? 0 : total / count;
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

  private resolveSubject(subject?: string | INatsProvider<any>): string | undefined {
    if (!subject) return undefined;
    if (typeof subject === "string") return subject;
    return subject.getNatsConfig().subject;
  }

  private serializeKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const sortedLabels = Object.keys(labels).sort().map(k => `${k}=${labels[k]}`).join(',');
    return `${name}{${sortedLabels}}`;
  }

  async getSnapshot(): Promise<any> {
    const keys = [
      `${this.prefix}:received`,
      `${this.prefix}:success`,
      `${this.prefix}:error`,
      `${this.prefix}:latency:total`,
      `${this.prefix}:counters`,
      `${this.prefix}:gauges`
    ];

    const results = await Promise.all(keys.map(k => this.redis.hgetall(k)));
    
    return {
      received: results[0],
      success: results[1],
      error: results[2],
      latency: results[3],
      counters: results[4],
      gauges: results[5]
    };
  }
}
