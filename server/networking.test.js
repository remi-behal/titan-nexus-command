import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as Client } from 'socket.io-client';
import { spawn } from 'child_process';
import path from 'path';

describe('Server Networking - Reconnection and Resilience', () => {
    let serverProcess;
    let url = 'http://localhost:3015';

    beforeAll(async () => {
        const serverPath = path.resolve(__dirname, 'index.js');
        serverProcess = spawn('node', [serverPath], {
            env: { ...process.env, PORT: '3015' },
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
    });

    afterAll(async () => {
        serverProcess?.kill('SIGKILL');
        await new Promise((r) => setTimeout(r, 200));
    });

    // Ensure each test starts with a fresh server state
    const resetServer = async () => {
        const resetClient = Client(url);
        await new Promise((resolve) => resetClient.once('connect', resolve));
        resetClient.emit('restartGame');
        await new Promise((resolve) => setTimeout(resolve, 200));
        resetClient.disconnect();
    };

    it('should send current game state immediately upon reconnection (id: 67)', async () => {
        await resetServer();
        let client = Client(url);

        // Connect initial
        client.emit('authenticate', 'test-token-id-67');
        const firstStatePromise = new Promise((resolve) => client.once('gameStateUpdate', resolve));
        await firstStatePromise;

        // Disconnect
        client.disconnect();

        // Reconnect
        client.connect();
        client.emit('authenticate', 'test-token-id-67');

        // Wait for fresh state update
        const secondStatePromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(
                () => reject(new Error('Did not receive state after reconnect')),
                2000
            );
            client.once('gameStateUpdate', (state) => {
                clearTimeout(timeout);
                resolve(state);
            });
        });

        const state = await secondStatePromise;
        expect(state).toBeDefined();
        expect(state.turn).toBeGreaterThanOrEqual(0);

        client.disconnect();
    });

    it('should process actions even if a player disconnects after locking in (id: 69)', async () => {
        await resetServer();
        let client1 = Client(url);
        let client2 = Client(url);

        // Wait for connection and assignment
        client1.emit('authenticate', 'test-token-p1');
        client2.emit('authenticate', 'test-token-p2');

        const p1Assign = new Promise((resolve) => client1.once('playerAssignment', resolve));
        const p2Assign = new Promise((resolve) => client2.once('playerAssignment', resolve));
        await Promise.all([p1Assign, p2Assign]);

        // Get initial state
        const statePromise = new Promise((resolve) => client1.once('gameStateUpdate', resolve));
        client1.emit('requestState');
        const state = await statePromise;
        const p1Hub = state.entities.find((e) => e.owner === 'player1' && e.type === 'HUB');

        const actions = [
            {
                playerId: 'player1',
                type: 'LAUNCH',
                itemType: 'HUB',
                sourceId: p1Hub.id,
                sourceX: p1Hub.x,
                sourceY: p1Hub.y,
                angle: 0,
                distance: 100
            }
        ];

        // Player 1 Locks In
        client1.emit('submitActions', actions);

        // Wait for syncStatus to confirm lock
        await new Promise((resolve) => {
            const check = (status) => {
                if (status.lockedIn.player1) {
                    client1.off('syncStatus', check);
                    resolve();
                }
            };
            client1.on('syncStatus', check);
        });

        // Player 1 DISCONNECTS
        client1.disconnect();

        // Player 2 Locks In
        client2.emit('submitActions', []);

        // Verify turn resolution starts
        const resolutionStarted = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Resolution did not start')), 5000);
            client2.on('resolutionStatus', (status) => {
                if (status.active) {
                    clearTimeout(timeout);
                    resolve(true);
                }
            });
        });

        expect(resolutionStarted).toBe(true);

        client2.disconnect();
    });

    it('should delay outgoing messages when SIMULATED_LATENCY is set (id: 68)', async () => {
        const latency = 150;
        const latencyServerPort = '3016';
        const serverPath = path.resolve(__dirname, 'index.js');

        const latencyServer = spawn('node', [serverPath], {
            env: { ...process.env, PORT: latencyServerPort, SIMULATED_LATENCY: latency.toString() },
            stdio: 'pipe'
        });

        await new Promise((resolve) => {
            latencyServer.stdout.on('data', (data) => {
                if (data.toString().includes('SERVER RUNNING')) resolve();
            });
        });

        const client = Client(`http://localhost:${latencyServerPort}`);
        client.emit('authenticate', 'latency-test-token');

        const startTime = Date.now();
        const statePromise = new Promise((resolve) => client.once('gameStateUpdate', resolve));

        await statePromise;
        const duration = Date.now() - startTime;

        // cleanup early
        client.disconnect();
        latencyServer.kill('SIGKILL');
        await new Promise((r) => setTimeout(r, 200));

        expect(duration).toBeGreaterThanOrEqual(latency);
    }, 10000);

    it('should persist individual player slots using session tokens (id: 67)', async () => {
        await resetServer();

        const token1 = 'token-player-1';
        const token2 = 'token-player-2';
        const token3 = 'token-spectator';

        const client1 = Client(url);
        client1.emit('authenticate', token1);
        const p1Assign = await new Promise((resolve, reject) => {
            const t = setTimeout(() => reject(new Error('P1 Timeout')), 2000);
            client1.once('playerAssignment', (id) => {
                clearTimeout(t);
                resolve(id);
            });
        });
        expect(p1Assign).toBe('player1');
        client1.disconnect();

        const client2 = Client(url);
        client2.emit('authenticate', token2);
        const p2Assign = await new Promise((resolve) => client2.once('playerAssignment', resolve));
        expect(p2Assign).toBe('player2');
        client2.disconnect();

        // Client 3 tries to join after 1 and 2 disconnect
        const client3 = Client(url);
        client3.emit('authenticate', token3);
        const p3Assign = await new Promise((resolve) => client3.once('playerAssignment', resolve));
        expect(p3Assign).toBe('spectator'); // Both slots reserved
        client3.disconnect();

        // Client 1 reconnects
        const client1Reconnect = Client(url);
        client1Reconnect.emit('authenticate', token1);
        const p1ReAssign = await new Promise((resolve) =>
            client1Reconnect.once('playerAssignment', resolve)
        );
        expect(p1ReAssign).toBe('player1'); // Reclaims slot
        client1Reconnect.disconnect();
    });
});
