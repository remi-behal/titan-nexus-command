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
            env: { ...process.env, PORT: '3008' },
            stdio: 'pipe'
        });

        await new Promise((resolve) => {
            serverProcess.stdout.on('data', (data) => {
                const output = data.toString();
                if (output.includes('SERVER RUNNING')) resolve();
            });
        });

        client1 = Client('http://localhost:3008');
        client2 = Client('http://localhost:3008');

        await new Promise((resolve) => {
            let authenticated = 0;
            const onAuth = () => {
                if (++authenticated === 2) resolve();
            };
            client1.on('playerAssignment', onAuth);
            client2.on('playerAssignment', onAuth);

            client1.emit('authenticate', 'transition-token-p1');
            client2.emit('authenticate', 'transition-token-p2');
        });
    });

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
