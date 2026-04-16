import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as Client } from 'socket.io-client';
import { spawn } from 'child_process';
import path from 'path';

describe('Auto-Start Integration', () => {
    let serverProcess;
    let client1;
    let client2;
    const PORT = '3019';

    beforeAll(async () => {
        const serverPath = path.resolve(__dirname, 'index.js');
        serverProcess = spawn('node', [serverPath], {
            env: { ...process.env, PORT },
            stdio: 'pipe'
        });

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Server failed to start')), 10000);
            serverProcess.stdout.on('data', (data) => {
                const out = data.toString();
                if (out.includes('SERVER RUNNING')) {
                    clearTimeout(timeout);
                    resolve();
                }
            });
        });

        client1 = Client(`http://localhost:${PORT}`);
        client2 = Client(`http://localhost:${PORT}`);
    });

    afterAll(async () => {
        client1?.disconnect();
        client2?.disconnect();
        serverProcess?.kill('SIGKILL');
        await new Promise((r) => setTimeout(r, 200));
    });

    it('should allow clients to auto-join and start the match', async () => {
        // Authenticate both
        client1.emit('authenticate', 'token1');
        client2.emit('authenticate', 'token2');

        // Wait for both to be authenticated
        await Promise.all([
            new Promise(res => client1.once('playerAssignment', res)),
            new Promise(res => client2.once('playerAssignment', res))
        ]);

        // Auto-join client 1
        const update1 = await new Promise((resolve) => {
            client1.once('lobby:update', resolve);
            client1.emit('lobby:autoJoin');
        });

        expect(update1.slots[0]).not.toBeNull();
        expect(update1.slots[0].token).toBe('token1');
        expect(update1.slots[0].ready).toBe(true);
        expect(update1.status).toBe('LOBBY');

        // Auto-join client 2 - this should trigger matchStarted
        const matchStartedPromise = new Promise((resolve) => {
            client1.on('matchStarted', resolve);
        });

        client2.emit('lobby:autoJoin');

        const matchData = await matchStartedPromise;
        expect(matchData.playerAssignments.player1).toBe('token1');
        expect(matchData.playerAssignments.player2).toBe('token2');
    });
});
