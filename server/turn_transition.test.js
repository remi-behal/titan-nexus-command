
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
            let connected = 0;
            const onConnect = () => { if (++connected === 2) resolve(); };
            client1.on('connect', onConnect);
            client2.on('connect', onConnect);
        });
    });

    afterAll(() => {
        client1?.disconnect();
        client2?.disconnect();
        serverProcess?.kill();
    });

    it('should reset the timer to 30s and unlock players at start of Turn 2', async () => {
        // 1. Initial State Check
        let initialTurn = 0;
        await new Promise(resolve => client1.once('gameStateUpdate', state => {
            initialTurn = state.turn;
            resolve();
        }));

        // 2. Submit both players to trigger resolution
        client1.emit('submitActions', []);
        client2.emit('submitActions', []);

        // 3. Wait for resolution lifecycle
        let resolutionStarted = false;
        let resolutionFinished = false;
        client1.on('resolutionStatus', (status) => {
            if (status.active) resolutionStarted = true;
            if (!status.active && resolutionStarted) resolutionFinished = true;
        });

        // Loop until resolution is finished
        while (!resolutionFinished) {
            await new Promise(r => setTimeout(r, 500));
        }

        // 4. Verify Turn 2 state
        // We expect: turn incremented, timer back to 30, and lockedIn reset to false
        let finalTurn = 0;
        let finalTimer = 0;
        let finalLockedIn = null;

        await new Promise(resolve => {
            client1.once('gameStateUpdate', state => {
                finalTurn = state.turn;
                resolve();
            });
            client1.emit('requestState');
        });

        await new Promise(resolve => {
            client1.once('timerUpdate', time => {
                finalTimer = time;
                resolve();
            });
        });

        await new Promise(resolve => {
            client1.once('syncStatus', status => {
                finalLockedIn = status.lockedIn;
                resolve();
            });
        });

        expect(finalTurn).toBe(initialTurn + 1);
        expect(finalTimer).toBe(30);
        expect(finalLockedIn.player1).toBe(false);
        expect(finalLockedIn.player2).toBe(false);
    }, 30000); // Increased to 30s for full resolution simulation
});
