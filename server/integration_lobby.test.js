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
        client1.emit('authenticate', 'test-token');
        const update = await new Promise((resolve) => {
            const onUpdate = (data) => {
                if (data.id === 'default') {
                    client1.off('lobby:update', onUpdate);
                    resolve(data);
                }
            };
            client1.on('lobby:update', onUpdate);
        });
        expect(update.id).toBe('default');
        expect(update.slots).toHaveLength(8);
    });

    it('should allow claiming a seat and receiving update', async () => {
        client1.emit('lobby:claimSeat', 0);
        const update = await new Promise((resolve) => {
            const onUpdate = (data) => {
                if (data.slots[0] && data.slots[0].token === 'test-token') {
                    client1.off('lobby:update', onUpdate);
                    resolve(data);
                }
            };
            client1.on('lobby:update', onUpdate);
        });
        expect(update.slots[0].token).toBe('test-token');
    });

    it('should allow claiming a seat with a custom name', async () => {
        const update = await new Promise((resolve) => {
            client1.once('lobby:update', resolve);
            client1.emit('lobby:claimSeat', { slotIndex: 1, playerName: 'Commander X' });
        });
        expect(update.slots[1].playerName).toBe('Commander X');
        expect(update.slots[0]).toBeNull();
    });
});
