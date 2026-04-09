import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as Client } from 'socket.io-client';
import { spawn } from 'child_process';
import path from 'path';

describe('Server Networking - Reconnection and Resilience', () => {
    let serverProcess;
    let url = 'http://localhost:3025';

    beforeAll(async () => {
        const serverPath = path.resolve(__dirname, 'index.js');
        serverProcess = spawn('node', [serverPath], {
            env: { ...process.env, PORT: '3025' },
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
        const restarted = new Promise((resolve) => resetClient.once('matchRestarted', resolve));
        resetClient.emit('restartGame');
        await restarted;
        resetClient.disconnect();
    };

    const lobbyHandshake = async (client, seatIndex, token) => {
        client.emit('authenticate', token);
        await new Promise((r) => setTimeout(r, 200));
        client.emit('lobby:claimSeat', seatIndex);
        await new Promise((r) => setTimeout(r, 200));
        client.emit('lobby:ready', true);
    };

    it('should send current game state immediately upon reconnection (id: 67)', async () => {
        await resetServer();
        let client = Client(url);

        // Connect initial and start match
        // Note: We need a second client to start the match
        const client2 = Client(url);
        await lobbyHandshake(client, 0, 'token-id-67-p1');
        await lobbyHandshake(client2, 1, 'token-id-67-p2');

        const firstStatePromise = new Promise((resolve) => client.once('gameStateUpdate', resolve));
        await firstStatePromise;

        // Disconnect
        client.disconnect();

        // Reconnect
        client.connect();
        client.emit('authenticate', 'token-id-67-p1');

        // Wait for fresh state update
        const secondStatePromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(
                () => reject(new Error('Did not receive state after reconnect')),
                5000
            );
            client.once('gameStateUpdate', (state) => {
                clearTimeout(timeout);
                resolve(state);
            });
        });

        const state = await secondStatePromise;
        expect(state).toBeDefined();
        expect(state.turn).toBeGreaterThanOrEqual(1);

        client.disconnect();
        client2.disconnect();
    }, 15000);

    it('should process actions even if a player disconnects after locking in (id: 69)', async () => {
        await resetServer();
        let client1 = Client(url);
        let client2 = Client(url);

        // Register listeners BEFORE emiting authenticate to avoid race conditions
        const p1Assign = new Promise((resolve) => {
            client1.on('playerAssignment', function listener(id) {
                if (id) {
                    client1.off('playerAssignment', listener);
                    resolve(id);
                }
            });
        });
        const p2Assign = new Promise((resolve) => {
            client2.on('playerAssignment', function listener(id) {
                if (id) {
                    client2.off('playerAssignment', listener);
                    resolve(id);
                }
            });
        });

        // Wait for connection AND assignment via handshake
        await lobbyHandshake(client1, 0, 'test-token-p1');
        await lobbyHandshake(client2, 1, 'test-token-p2');

        const [id1, id2] = await Promise.all([p1Assign, p2Assign]);
        expect(id1).toBe('player1');
        expect(id2).toBe('player2');

        // Get initial state
        const statePromise = new Promise((resolve) => {
            const onUpdate = (s) => {
                if (s.turn >= 1) {
                    client1.off('gameStateUpdate', onUpdate);
                    resolve(s);
                }
            };
            client1.on('gameStateUpdate', onUpdate);
        });
        client1.emit('requestState');
        const state = await statePromise;
        const p1Hub = state.entities.find((e) => e.owner === 'player1' && (e.type === 'HUB' || e.itemType === 'HUB'));
        expect(p1Hub).toBeDefined();

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
    }, 15000);

    it('should delay outgoing messages when SIMULATED_LATENCY is set (id: 68)', async () => {
        const latency = 150;
        const latencyServerPort = '3026';
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
        const client2 = Client(`http://localhost:${latencyServerPort}`);

        // Handshake to start match so we get gameStateUpdate
        await lobbyHandshake(client, 0, 'latency-test-token-p1');
        await lobbyHandshake(client2, 1, 'latency-test-token-p2');

        const startTime = Date.now();
        const statePromise = new Promise((resolve) => {
            const onUpdate = (s) => {
                if (s.turn >= 1) {
                    client.off('gameStateUpdate', onUpdate);
                    resolve(s);
                }
            };
            client.on('gameStateUpdate', onUpdate);
        });

        client.emit('requestState');
        await statePromise;
        const duration = Date.now() - startTime;

        // cleanup early
        client.disconnect();
        client2.disconnect();
        latencyServer.kill('SIGKILL');
        await new Promise((r) => setTimeout(r, 200));

        expect(duration).toBeGreaterThanOrEqual(latency);
    }, 15000);

    it('should persist individual player slots using session tokens (id: 67)', async () => {
        await resetServer();

        const token1 = 'token-player-1';
        const token2 = 'token-player-2';
        const token3 = 'token-spectator';

        const client1 = Client(url);
        const client2 = Client(url);

        // Start match to lock in slots
        await lobbyHandshake(client1, 0, token1);
        await lobbyHandshake(client2, 1, token2);

        // Wait for match start
        await new Promise(r => client1.once('matchStarted', r));

        // Disconnect P1
        client1.disconnect();

        const getAssignment = (client) => {
            return new Promise((resolve) => {
                client.on('playerAssignment', function listener(id) {
                    if (id) {
                        client.off('playerAssignment', listener);
                        resolve(id);
                    }
                });
            });
        };

        // Client 3 tries to join (should be spectator because slot 0 is reserved)
        const client3 = Client(url);
        client3.emit('authenticate', token3);
        const p3Assign = await getAssignment(client3);
        expect(p3Assign).toBe('spectator');
        client3.disconnect();

        // Client 1 reconnects
        const client1Reconnect = Client(url);
        client1Reconnect.emit('authenticate', token1);
        const p1ReAssign = await new Promise((resolve) =>
            client1Reconnect.once('playerAssignment', resolve)
        );
        expect(p1ReAssign).toBe('player1'); // Reclaims slot
        client1Reconnect.disconnect();
        client2.disconnect();
    }, 20000);
});
