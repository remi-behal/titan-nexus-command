import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as Client } from 'socket.io-client';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Reproduce Turn Button Bug & PassTurn', () => {
    let serverProcess;
    let client1, client2, spectator;

    beforeAll(async () => {
        const serverPath = path.resolve(__dirname, 'index.js');
        serverProcess = spawn('node', [serverPath], {
            env: { ...process.env, PORT: '3110' },
            stdio: 'pipe'
        });

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Server failed to start')), 15000);
            const listener = (data) => {
                if (data.toString().includes('SERVER RUNNING')) {
                    serverProcess.stdout.off('data', listener);
                    clearTimeout(timeout);
                    resolve();
                }
            };
            serverProcess.stdout.on('data', listener);
        });

        client1 = Client('http://localhost:3110');
        client2 = Client('http://localhost:3110');
        spectator = Client('http://localhost:3110');

        await new Promise((resolve) => {
            let auths = 0;
            const check = () => { if (++auths === 2) resolve(); };
            client1.on('playerAssignment', check);
            client2.on('playerAssignment', check);
            client1.emit('authenticate', 'token-p1');
            client2.emit('authenticate', 'token-p2');
        });

        // Claim seats and start match
        client1.emit('lobby:claimSeat', 0);
        client2.emit('lobby:claimSeat', 1);

        await new Promise(r => setTimeout(r, 200));
        client1.emit('lobby:ready', true);
        client2.emit('lobby:ready', true);

        await new Promise(resolve => {
            client1.on('matchStarted', resolve);
        });
    }, 30000);

    afterAll(() => {
        client1.disconnect();
        client2.disconnect();
        spectator.disconnect();
        serverProcess.kill('SIGKILL');
    });

    it('should assign correct players and spectator', async () => {
        let p1_id, p2_id, spec_id;
        await Promise.all([
            new Promise(r => { client1.once('playerAssignment', id => { p1_id = id; r(); }); client1.emit('requestState'); }),
            new Promise(r => { client2.once('playerAssignment', id => { p2_id = id; r(); }); client2.emit('requestState'); }),
            new Promise(r => { spectator.once('playerAssignment', id => { spec_id = id; r(); }); spectator.emit('authenticate', 'token-spec'); })
        ]);
        expect(p1_id).toBe('player1');
        expect(p2_id).toBe('player2');
        expect(spec_id).toBe('spectator');
    });

    it('should support passTurn and resolve turn', async () => {
        // P1 submits actions
        client1.emit('submitActions', []);

        // P2 passes turn
        client2.emit('passTurn');

        // Expect resolutionStatus to become active
        const resolution = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Resolution timeout')), 10000);
            client1.on('resolutionStatus', (status) => {
                if (status.active) {
                    clearTimeout(timeout);
                    resolve(status);
                }
            });
        });

        expect(resolution.active).toBe(true);
    });

    it('should NOT allow spectators to lock out players', async () => {
        // Wait for previous turn resolution to finish (resolution takes 3s)
        await new Promise(r => setTimeout(r, 4000));

        // Spectator attempts to submit actions (they shouldn't be allowed to)
        spectator.emit('submitActions', []);

        // Wait and check syncStatus
        await new Promise(r => setTimeout(r, 500));

        let syncStatus;
        client1.emit('requestState');
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('SyncStatus timeout')), 5000);
            const listener = (status) => {
                // We want the most recent syncStatus
                syncStatus = status;
                client1.off('syncStatus', listener);
                clearTimeout(timeout);
                resolve();
            };
            client1.on('syncStatus', listener);
        });

        // P1 should NOT be locked out by spectator's actions
        expect(syncStatus.lockedIn.player1).toBe(false);
        expect(syncStatus.lockedIn.player2).toBe(false);
        expect(syncStatus.lockedIn.undefined).toBeUndefined();
    }, 15000); // Explicit longer timeout for this test
});
