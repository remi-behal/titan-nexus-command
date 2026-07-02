import { describe, it, expect } from 'vitest';
import { io as Client } from 'socket.io-client';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { getFreePort } from './utils/test-helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Socket Reconnect Recovery Integration', () => {
    it('should preserve actions and send actionsUpdate on reconnect', async () => {
        const PORT = await getFreePort();
        const serverPath = path.resolve(__dirname, 'index.js');
        const serverProcess = spawn('node', [serverPath], {
            env: {
                ...process.env,
                PORT: String(PORT),
                TURN_DURATION: '10',
                RESOLUTION_ROUND_DELAY: '100',
                RESOLUTION_SUB_TICK_DELAY: '10'
            },
            stdio: 'pipe'
        });

        const serverLogs = [];
        await new Promise((resolve) => {
            serverProcess.stdout.on('data', (data) => {
                const out = data.toString();
                serverLogs.push(out);
                if (out.includes('SERVER RUNNING')) resolve();
            });
        });

        // 1. Connect P1 and P2, claim seats, ready up to start match
        const p1Token = 'token-p1-recovery';
        const p2Token = 'token-p2-recovery';
        let p1 = Client(`http://localhost:${PORT}`);
        let p2 = Client(`http://localhost:${PORT}`);

        let p1State = null;
        p1.on('gameStateUpdate', (state) => {
            p1State = state;
        });

        p1.emit('authenticate', p1Token);
        p2.emit('authenticate', p2Token);

        await new Promise((r) => setTimeout(r, 200));
        p1.emit('lobby:claimSeat', 0);
        p2.emit('lobby:claimSeat', 1);

        await new Promise((r) => setTimeout(r, 200));
        p1.emit('lobby:ready', true);
        p2.emit('lobby:ready', true);

        // Wait for match started
        const gameInitPromise = new Promise((resolve) => p1.once('matchStarted', resolve));
        await gameInitPromise;

        // Wait for initial gameStateUpdate to get the entities
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout waiting for initial state')), 5000);
            const interval = setInterval(() => {
                if (p1State !== null) {
                    clearTimeout(timeout);
                    clearInterval(interval);
                    resolve();
                }
            }, 50);
        });

        // Find starting HUB for player1
        const p1Hub = p1State.entities.find((e) => e.owner === 'player1' && e.type === 'HUB');
        expect(p1Hub).toBeDefined();

        // 2. Submit actions for P1 using valid starting hub as sourceId
        const testActions = [
            { playerId: 'player1', type: 'LAUNCH', itemType: 'HUB', sourceId: p1Hub.id, angle: 45, distance: 300 }
        ];
        p1.emit('submitActions', testActions);
        await new Promise((r) => setTimeout(r, 100));

        // 3. Disconnect P1 socket
        p1.disconnect();
        await new Promise((r) => setTimeout(r, 100));

        // 4. Reconnect and authenticate P1 with a new client connection
        let p1Reconnect = Client(`http://localhost:${PORT}`);
        let receivedActions = null;

        p1Reconnect.on('actionsUpdate', (actions) => {
            receivedActions = actions;
        });

        p1Reconnect.emit('authenticate', p1Token);

        // Wait for connection to authenticate and retrieve actions
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout waiting for actionsUpdate')), 5000);
            const interval = setInterval(() => {
                if (receivedActions !== null) {
                    clearTimeout(timeout);
                    clearInterval(interval);
                    resolve();
                }
            }, 50);
        });

        expect(receivedActions).toBeDefined();
        expect(receivedActions.length).toBe(1);
        expect(receivedActions[0].itemType).toBe('HUB');
        expect(receivedActions[0].sourceId).toBe(p1Hub.id);

        // Cleanup
        p1Reconnect.disconnect();
        p2.disconnect();
        serverProcess.kill('SIGKILL');
        await new Promise((r) => setTimeout(r, 200));
    });
});
