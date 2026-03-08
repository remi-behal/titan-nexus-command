
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as Client } from 'socket.io-client';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Server - Resolution Race Guard', () => {
    let serverProcess;
    let client1, client2;

    beforeAll(async () => {
        const serverPath = path.resolve(__dirname, 'index.js');
        serverProcess = spawn('node', [serverPath], {
            env: { ...process.env, PORT: '3009' },
            stdio: 'pipe'
        });

        await new Promise((resolve) => {
            serverProcess.stdout.on('data', (data) => {
                const output = data.toString();
                if (output.includes('SERVER RUNNING')) resolve();
            });
        });

        client1 = Client('http://localhost:3009');
        client2 = Client('http://localhost:3009');

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

    it('should ignore submissions sent DURING resolution', async () => {
        // 1. Trigger resolution by locking in Turn 1
        client1.emit('submitActions', []);
        client2.emit('submitActions', []);

        // 2. Wait for resolution to start
        let isResolving = false;
        client1.on('resolutionStatus', (status) => {
            if (status.active) isResolving = true;
        });

        while (!isResolving) {
            await new Promise(r => setTimeout(r, 100));
        }

        // 3. Send a "Malicious" submission while resolution is active
        // This simulates the user releasing a drag just after the timer expires
        let initialSyncReceived = false;
        client1.once('syncStatus', (status) => {
            initialSyncReceived = true;
        });

        // We want to verify that Turn 2 starts with UNLOCKED status,
        // even if we send a 'submitActions' right now.
        client1.emit('submitActions', []);

        // 4. Wait for resolution to finish
        let isFinished = false;
        client1.on('resolutionStatus', (status) => {
            if (!status.active) isFinished = true;
        });

        while (!isFinished) {
            await new Promise(r => setTimeout(r, 100));
        }

        // 5. Final Check: SyncStatus should show player1 UNLOCKED for Turn 2
        let finalLockedStatus = null;

        // Use a wrapper to wait for the message
        await new Promise(resolve => {
            client1.on('syncStatus', (status) => {
                finalLockedStatus = status.lockedIn;
                resolve();
            });
            client1.emit('requestState');
        });

        // With our new Responsive Behavior, pre-emptive submissions ARE accepted for the NEXT turn.
        // So finalLockedStatus should show player1 as TRUE (since we sent [] during resolution).
        expect(finalLockedStatus.player1).toBe(true);
        expect(finalLockedStatus.player2).toBe(false);
    }, 20000);
});
