import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as Client } from 'socket.io-client';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Reproduce Turn Button Bug', () => {
    let serverProcess;
    let client1, client2;

    beforeAll(async () => {
        const serverPath = path.resolve(__dirname, 'index.js');
        serverProcess = spawn('node', [serverPath], {
            env: { ...process.env, PORT: '3112' },
            stdio: 'pipe'
        });

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Server failed to start in 30s')), 30000);
            const listener = (data) => {
                if (data.toString().includes('SERVER RUNNING')) {
                    serverProcess.stdout.off('data', listener);
                    clearTimeout(timeout);
                    resolve();
                }
            };
            serverProcess.stdout.on('data', listener);
        });

        client1 = Client('http://localhost:3112');
        client2 = Client('http://localhost:3112');

        await new Promise((resolve) => {
            let auths = 0;
            const check = () => { if (++auths === 2) resolve(); };
            client1.on('playerAssignment', check);
            client2.on('playerAssignment', check);
            client1.emit('authenticate', 'token-p1');
            client2.emit('authenticate', 'token-p2');
        });

        client1.emit('lobby:claimSeat', 0);
        client2.emit('lobby:claimSeat', 1);
        await new Promise(r => setTimeout(r, 100));
        client1.emit('lobby:ready', true);
        client2.emit('lobby:ready', true);

        await new Promise(resolve => {
            client1.on('matchStarted', resolve);
        });
    }, 40000);

    afterAll(() => {
        client1.disconnect();
        client2.disconnect();
        serverProcess.kill('SIGKILL');
    });

    it('should NOT lock out P2 when P1 submits actions', async () => {
        let syncStatus;
        client1.emit('submitActions', []);

        await new Promise(r => {
            const listener = (status) => {
                if (status.lockedIn.player1 === true) {
                    syncStatus = status;
                    client2.off('syncStatus', listener);
                    r();
                }
            };
            client2.on('syncStatus', listener);
        });

        expect(syncStatus.lockedIn.player1).toBe(true);
        expect(syncStatus.lockedIn.player2).toBe(false);
    });

    it('should support passTurn and resolve turn', async () => {
        let received = false;
        client2.on('syncStatus', (status) => {
            if (status.lockedIn.player2 === true) received = true;
        });

        client2.emit('passTurn');
        await new Promise(r => setTimeout(r, 1000));

        expect(received).toBe(true);
    });
});
