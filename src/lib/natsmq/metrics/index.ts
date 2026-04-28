import { NatsMQMetrics, INatsMetrics } from "../types";

export * from "./redis-metrics";

export class DefaultNatsMQMetrics implements INatsMetrics {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();

  // --- INatsMetrics ---
  recordMessageReceived(subject: string): void {
    this.increment(`received:${subject}`);
  }

  recordProcessingSuccess(subject: string, _durationMs: number): void {
    this.increment(`success:${subject}`);
  }

  recordProcessingError(subject: string, type: string): void {
    this.increment(`error:${type}:${subject}`);
  }

  // --- NatsMQMetrics ---
  increment(name: string, value: number = 1, labels?: Record<string, string>): void {
    const key = this.serializeKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  gauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.serializeKey(name, labels);
    this.gauges.set(key, value);
  }

  async getCounter(subject: string, type: 'received' | 'success' | 'error'): Promise<number> {
    if (type === 'error') {
      return Array.from(this.counters.entries())
        .filter(([k]) => k.startsWith(`error:`) && k.endsWith(subject))
        .reduce((acc, [_, v]) => acc + v, 0);
    }
    const key = `${type}:${subject}`;
    return this.counters.get(key) || 0;
  }

  async getAverageLatency(_subject: string): Promise<number> {
    return 0;
  }

  recordCronError(name: string, error: string): void {
    this.increment(`cron:error:${name}`);
  }

  private serializeKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const sortedLabels = Object.keys(labels).sort().map(k => `${k}="${labels[k]}"`).join(',');
    return `${name}{${sortedLabels}}`;
  }
}
