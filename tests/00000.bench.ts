import "reflect-metadata";
import { bench, describe } from 'vitest';
import { EventEmitter as EventEmitter3 } from 'eventemitter3';
import { InternalTransport } from "../src/common/transport";

/**
 * Benchmark: EventEmitter3 vs InternalTransport (HyperRouter Premium)
 * Benchmarking the integrated implementation with No-op logger to measure raw performance.
 */

describe('Benchmark: EventEmitter3 vs InternalTransport', () => {
  const ee3 = new EventEmitter3();
  
  // Use a dummy logger to avoid console.log overhead during benchmarking
  const dummyLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {}
  };
  const it = new InternalTransport(dummyLogger);

  const topics = [
    'user.created',
    'user.updated',
    'order.placed',
    'order.shipped.global',
    'system.health.check',
    'logs.debug.ui',
    'a.b.c.d.e.f'
  ];

  topics.forEach(t => {
    ee3.on(t, () => { });
    it.listen(t, () => { });
  });

  it.listen('user.*', () => { });
  it.listen('order.>', () => { });
  it.listen('>', () => { });

  const data = { id: 123 };

  // Ensure cache is warm
  topics.forEach(t => (it as any).match(t));
  (it as any).match('user.new');
  (it as any).match('order.any.thing');

  bench('EventEmitter3 - Exact Match', () => {
    ee3.emit('user.created', data);
    ee3.emit('order.shipped.global', data);
  });

  bench('InternalTransport - Exact Match (Cached)', () => {
    it.emit('user.created', data);
    it.emit('order.shipped.global', data);
  });

  bench('InternalTransport - Wildcard Match (Cached)', () => {
    it.emit('user.new', data);
    it.emit('order.any.thing', data);
  });
});
