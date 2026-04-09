import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as Client } from 'socket.io-client';
import { spawn } from 'child_process';
import path from 'path';

describe('Lobby Integration Handshake', () => {
    let serverProcess;
    let client1;

    beforeAll(async () => {
        const serverPath = path.resolve(__dirname, 'index.js');
        serverProcess = spawn('node', [serverPath], {
            env: { ...process.env, PORT: '3018' },
            stdio: 'pipe'
        });

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Server failed to start')), 30000);
            serverProcess.stdout.on('data', (data) => {
                const out = data.toString();
                console.log('[Server Stdout]:', out);
                if (out.includes('SERVER RUNNING')) {
                    clearTimeout(timeout);
                    resolve();
                }
            });
            serverProcess.stderr.on('data', (data) => {
                console.error('[Server Stderr]:', data.toString());
            });
        });

        client1 = Client('http://localhost:3018');
    });

    afterAll(async () => {
        client1?.disconnect();
        serverProcess?.kill('SIGKILL');
        await new Promise((r) => setTimeout(r, 200));
    });

    it('should receive lobby update on connection', async () => {
        const update = await new Promise((resolve) => {
            client1.on('lobby:update', resolve);
            client1.emit('authenticate', 'test-token');
        });
        expect(update.id).toBe('default');
        expect(update.slots).toHaveLength(2);
    });

    it('should allow claiming a seat and receiving update', async () => {
        const update = await new Promise((resolve) => {
            client1.once('lobby:update', resolve);
            client1.emit('lobby:claimSeat', 0);
        });
        expect(update.slots[0].token).toBe('test-token');
    });
});
