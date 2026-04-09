import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as Client } from 'socket.io-client';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Server - Turn Transition & Timer Continuity', () => {
    let serverProcess;
    let client1, client2;

    beforeAll(async () => {
        const serverPath = path.resolve(__dirname, 'index.js');
        serverProcess = spawn('node', [serverPath], {
            env: { ...process.env, PORT: '3108' },
            stdio: 'pipe'
        });

        // Drain stdout/stderr to prevent buffer freezing
        serverProcess.stdout.on('data', () => { });
        serverProcess.stderr.on('data', () => { });

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Server failed to start in 15s')), 15000);
            serverProcess.stdout.on('data', function listener(data) {
                const output = data.toString();
                if (output.includes('SERVER RUNNING')) {
                    serverProcess.stdout.off('data', listener);
                    clearTimeout(timeout);
                    resolve();
                }
            });
        });

        client1 = Client('http://localhost:3108');
        client2 = Client('http://localhost:3108');

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Auth timeout')), 10000);
            let authenticated = 0;
            const onAuth = () => {
                if (++authenticated === 2) { clearTimeout(timeout); resolve(); }
            };
            client1.on('playerAssignment', onAuth);
            client2.on('playerAssignment', onAuth);

            client1.emit('authenticate', 'transition-token-p1');
            client2.emit('authenticate', 'transition-token-p2');
        });

        // Lobby Handshake
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Lobby handshake timeout')), 10000);
            client1.once('matchStarted', () => { clearTimeout(timeout); resolve(); });

            client1.emit('lobby:claimSeat', 0);
            client2.emit('lobby:claimSeat', 1);
            setTimeout(() => {
                client1.emit('lobby:ready', true);
                client2.emit('lobby:ready', true);
            }, 300);
        });
    }, 45000);

    afterAll(async () => {
        client1?.disconnect();
        client2?.disconnect();
        serverProcess?.kill('SIGKILL');
        await new Promise((r) => setTimeout(r, 200));
    });

    it('should reset the timer to 30s and unlock players at start of Turn 2', async () => {
        // 1. Initial State Check
        let initialTurn = 0;
        await new Promise((resolve) => {
            client1.once('gameStateUpdate', (state) => {
                initialTurn = state.turn;
                resolve();
            });
            client1.emit('requestState');
        });

        // 2. Submit both players to trigger resolution
        client1.emit('submitActions', []);
        client2.emit('submitActions', []);

        // 3. Wait for the state to transition to Turn 2 with unlocked status
        // We'll poll requestState until we see what we want, with a timeout
        const success = await new Promise((resolve) => {
            const check = (state) => {
                if (state.turn === initialTurn + 1) {
                    // Check lockedIn status via a separate request or integrated check
                    client1.emit('requestState');
                    client1.once('syncStatus', (status) => {
                        if (!status.lockedIn.player1 && !status.lockedIn.player2) {
                            resolve(true);
                        }
                    });
                }
            };
            client1.on('gameStateUpdate', check);

            // Timeout safety
            setTimeout(() => resolve(false), 25000);
        });

        expect(success).toBe(true);

        // Final verification of timer
        let finalTimer = 0;
        await new Promise((resolve) => {
            client1.once('timerUpdate', (time) => {
                finalTimer = time;
                resolve();
            });
            client1.emit('requestState');
        });
        expect(finalTimer).toBeGreaterThan(0);
        expect(finalTimer).toBeLessThanOrEqual(30);
    }, 30000);
});
