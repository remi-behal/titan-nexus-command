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

            // Connect sequentially to ensure deterministic assignment
            (async () => {
                client1.emit('authenticate', 'restart-token-p1');
                await new Promise((r) => setTimeout(r, 200));
                client2.emit('authenticate', 'restart-token-p2');
            })();
        });
    });

    afterAll(async () => {
        client1?.disconnect();
        client2?.disconnect();
        serverProcess?.kill('SIGKILL');
        await new Promise((r) => setTimeout(r, 200));
    });

    it('should automatically re-claim slots after a match restart', async () => {
        expect(p1Id).toBe('player1');
        expect(p2Id).toBe('player2');

        // Simulate client-side auto-reclaim logic (mirroring App.jsx)
        client1.on('matchRestarted', () => {
            client1.emit('authenticate', 'restart-token-p1');
        });
        client2.on('matchRestarted', () => {
            client2.emit('authenticate', 'restart-token-p2');
        });

        // Set up listeners for the new assignments
        const nextAssignmentP1 = new Promise((resolve) =>
            client1.once('playerAssignment', resolve)
        );
        const nextAssignmentP2 = new Promise((resolve) =>
            client2.once('playerAssignment', resolve)
        );

        // Trigger restart from client 1
        client1.emit('restartGame');

        // Wait for re-assignment
        const newId1 = await nextAssignmentP1;
        const newId2 = await nextAssignmentP2;

        // Both should still be players (not spectators)
        expect(['player1', 'player2']).toContain(newId1);
        expect(['player2', 'player1']).toContain(newId2);
        expect(newId1).not.toBe(newId2);

        console.log(`Successfully re-claimed slots: ${newId1}, ${newId2}`);
    }, 10000);
});
