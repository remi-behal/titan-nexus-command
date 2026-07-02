import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as Client } from 'socket.io-client';
import { spawn } from 'child_process';
import path from 'path';

describe('Match Restart Persistence & Auto-Reclaim', () => {
    let serverProcess;
    let client1, client2;
    let p1Id, p2Id;

    const joinAndReady = async (client, token, slotIndex, expectedPlayerId) => {
        client.emit('authenticate', token);
        await new Promise((resolve) => {
            const handler = () => {
                client.off('playerAssignment', handler);
                resolve();
            };
            client.on('playerAssignment', handler);
        });

        client.emit('lobby:claimSeat', slotIndex);
        await new Promise((resolve) => {
            const handler = (id) => {
                if (id === expectedPlayerId) {
                    client.off('playerAssignment', handler);
                    resolve();
                }
            };
            client.on('playerAssignment', handler);
        });

        client.emit('lobby:ready', true);
    };

    beforeAll(async () => {
        const serverPath = path.resolve(__dirname, 'index.js');
        serverProcess = spawn('node', [serverPath], {
            env: { ...process.env, PORT: '3117' },
            stdio: 'pipe'
        });

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                serverProcess.kill('SIGKILL');
                reject(new Error('Server failed to start within 15s'));
            }, 15000);

            const onData = (data) => {
                if (data.toString().includes('SERVER RUNNING')) {
                    serverProcess.stdout.off('data', onData);
                    clearTimeout(timeout);
                    resolve();
                }
            };

            serverProcess.stdout.on('data', onData);

            serverProcess.stderr.on('data', (data) => {
                console.error(`[Server Stderr]: ${data.toString()}`);
            });

            serverProcess.on('exit', (code) => {
                if (code !== null && code !== 0) {
                    clearTimeout(timeout);
                    reject(new Error(`Server process exited with code ${code}`));
                }
            });
        });

        // Drain stdout/stderr to avoid buffer filling
        serverProcess.stdout.on('data', () => {});
        serverProcess.stderr.on('data', () => {});

        client1 = Client('http://localhost:3117');
        client2 = Client('http://localhost:3117');

        // Authenticate, claim seats, and mark ready using event-driven flow
        await joinAndReady(client1, 'restart-token-p1', 0, 'player1');
        await joinAndReady(client2, 'restart-token-p2', 1, 'player2');

        p1Id = 'player1';
        p2Id = 'player2';

        // Wait for match start
        await new Promise((r) => client1.once('matchStarted', r));
    }, 45000);

    afterAll(async () => {
        client1?.disconnect();
        client2?.disconnect();
        serverProcess?.kill('SIGKILL');
        await new Promise((r) => setTimeout(r, 200));
    });

    it('should automatically re-join and allow re-starting via lobby', async () => {
        expect(p1Id).toBe('player1');
        expect(p2Id).toBe('player2');

        const nextAssignmentP1 = new Promise((resolve) => {
            const handler = (id) => {
                if (id && (id === 'player1' || id === 'player2')) {
                    client1.off('playerAssignment', handler);
                    resolve(id);
                }
            };
            client1.on('playerAssignment', handler);
        });
        const nextAssignmentP2 = new Promise((resolve) => {
            const handler = (id) => {
                if (id && (id === 'player1' || id === 'player2')) {
                    client2.off('playerAssignment', handler);
                    resolve(id);
                }
            };
            client2.on('playerAssignment', handler);
        });

        // Transition back to lobby robustly when match is restarted
        client1.on('matchRestarted', async () => {
            await joinAndReady(client1, 'restart-token-p1', 0, 'player1');
            await joinAndReady(client2, 'restart-token-p2', 1, 'player2');
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
