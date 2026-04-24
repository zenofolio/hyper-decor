import "reflect-metadata";
import { describe, expect, it } from 'vitest';
import { InternalTransport } from "../src/common/transport";

describe('InternalTransport Premium (Integrated Radix Trie & Arena)', () => {
    
    it('should handle complex patterns: * , > , {a|b}', async () => {
        const transport = new InternalTransport();
        let count = 0;
        
        await transport.listen('message.*.queue', () => { count++; });
        await transport.listen('message.>', () => { count++; });
        await transport.listen('message.{que|meta}.queue', () => { count++; });
        
        // message.que.queue matches all 3
        await transport.emit('message.que.queue', {}); 
        expect(count).toBe(3);

        count = 0;
        await transport.emit('message.foo.bar.baz', {});
        // Only message.> matches
        expect(count).toBe(1);
    });

    it('should manage memory via Two-Map LRU cache', async () => {
        const transport = new InternalTransport();
        
        // Emit 6000 unique topics
        for (let i = 0; i < 6000; i++) {
            await transport.emit(`user.topic_${i}`, {});
        }
        
        const cacheSize = (transport as any).__getCacheSize();
        expect(cacheSize).toBeLessThanOrEqual(5000);
    });

    it('should handle many concurrent listeners', async () => {
        const transport = new InternalTransport();
        let count = 0;
        const listeners = 100;
        
        for (let i = 0; i < listeners; i++) {
            await transport.listen('shared.topic', () => { count++; });
        }
        
        await transport.emit('shared.topic', {});
        expect(count).toBe(listeners);
    });

    it('should correctly handle async execution', async () => {
        const transport = new InternalTransport();
        let finished = false;
        
        await transport.listen('async.topic', async () => {
            await new Promise(r => setTimeout(r, 10));
            finished = true;
        });
        
        await transport.emit('async.topic', {});
        expect(finished).toBe(true);
    });
});
