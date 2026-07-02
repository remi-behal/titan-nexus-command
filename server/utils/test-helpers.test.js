import { describe, it, expect } from 'vitest';
import { getFreePort } from './test-helpers.js';
import net from 'net';

describe('Test Helpers - getFreePort', () => {
    it('should return a valid free port number', async () => {
        const port = await getFreePort();
        expect(port).toBeTypeOf('number');
        expect(port).toBeGreaterThan(1024);
        expect(port).toBeLessThan(65536);

        // Verify we can bind to it
        const server = net.createServer();
        await new Promise((resolve) => {
            server.listen(port, resolve);
        });
        expect(server.listening).toBe(true);
        await new Promise((resolve) => server.close(resolve));
    });
});
