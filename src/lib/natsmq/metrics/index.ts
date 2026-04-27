import { NatsMQMetrics } from "../types";

export class DefaultNatsMQMetrics implements NatsMQMetrics {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();

  increment(name: string, value: number = 1, labels?: Record<string, string>): void {
    const key = this.serializeKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  gauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.serializeKey(name, labels);
    this.gauges.set(key, value);
  }

  getSnapshot() {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges)
    };
  }

  private serializeKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const sortedLabels = Object.keys(labels).sort().map(k => `${k}="${labels[k]}"`).join(',');
    return `${name}{${sortedLabels}}`;
  }
}
