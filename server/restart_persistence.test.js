import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as Client } from 'socket.io-client';
import { spawn } from 'child_process';
import path from 'path';

describe('Match Restart Persistence & Auto-Reclaim', () => {
    let serverProcess;
    let client1, client2;
    let p1Id, p2Id;

    beforeAll(async () => {
        const serverPath = path.resolve(__dirname, 'index.js');
        serverProcess = spawn('node', [serverPath], {
            env: { ...process.env, PORT: '3017' },
            stdio: 'pipe'
        });

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Server failed to start')), 5000);
            serverProcess.stdout.on('data', (data) => {
                if (data.toString().includes('SERVER RUNNING')) {
                    clearTimeout(timeout);
                    resolve();
                }
            });
        });

        client1 = Client('http://localhost:3017');
        client2 = Client('http://localhost:3017');

        await new Promise((resolve) => {
            let authenticated = 0;
            const onAuth1 = (id) => {
                p1Id = id;
                if (++authenticated === 2) resolve();
            };
            const onAuth2 = (id) => {
                p2Id = id;
                if (++authenticated === 2) resolve();
            };
            client1.on('playerAssignment', onAuth1);
            client2.on('playerAssignment', onAuth2);

            // Connect and handshake
            (async () => {
                client1.emit('authenticate', 'restart-token-p1');
                client2.emit('authenticate', 'restart-token-p2');
                await new Promise((r) => setTimeout(r, 200));

                client1.emit('lobby:claimSeat', 0);
                client2.emit('lobby:claimSeat', 1);
                await new Promise((r) => setTimeout(r, 200));

                client1.emit('lobby:ready', true);
                client2.emit('lobby:ready', true);
            })();
        }, 30000);
    });

    afterAll(async () => {
        client1?.disconnect();
        client2?.disconnect();
        serverProcess?.kill('SIGKILL');
        await new Promise((r) => setTimeout(r, 200));
    });

    it('should automatically re-join and allow re-starting via lobby', async () => {
        expect(p1Id).toBe('player1');
        expect(p2Id).toBe('player2');

        const nextAssignmentP1 = new Promise((resolve) =>
            client1.once('playerAssignment', resolve)
        );
        const nextAssignmentP2 = new Promise((resolve) =>
            client2.once('playerAssignment', resolve)
        );

        // Transition back to lobby
        client1.on('matchRestarted', async () => {
            client1.emit('authenticate', 'restart-token-p1');
            client2.emit('authenticate', 'restart-token-p2');
            await new Promise((r) => setTimeout(r, 200));
            client1.emit('lobby:claimSeat', 0);
            client2.emit('lobby:claimSeat', 1);
            await new Promise((r) => setTimeout(r, 200));
            client1.emit('lobby:ready', true);
            client2.emit('lobby:ready', true);
        });

        // Trigger restart
        client1.emit('restartGame');

        // Wait for re-assignment
        const newId1 = await nextAssignmentP1;
        const newId2 = await nextAssignmentP2;

        expect(['player1', 'player2']).toContain(newId1);
        expect(['player2', 'player1']).toContain(newId2);
        console.log(`Successfully re-started match via lobby: ${newId1}, ${newId2}`);
    }, 15000);
});
