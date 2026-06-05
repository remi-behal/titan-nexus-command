import { describe, it, beforeAll, afterAll, expect } from 'vitest';
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
            env: { ...process.env, PORT: '3111' },
            stdio: 'pipe'
        });

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Server failed to start in 30s')), 30000);
            serverProcess.stdout.on('data', function listener(data) {
                const output = data.toString();
                if (output.includes('SERVER RUNNING')) {
                    serverProcess.stdout.off('data', listener);
                    clearTimeout(timeout);
                    resolve();
                }
            });
        });

        client1 = Client('http://localhost:3111');
        client2 = Client('http://localhost:3111');

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

    it('should ignore submissions sent DURING resolution', async () => {
        let newTurnStarted = false;
        let lastReceivedState = null;

        const stateListener = (state) => {
            lastReceivedState = state;
            if (state.turn > 0 && state.phase === 'PLANNING') {
                newTurnStarted = true;
            }
        };
        client1.on('gameStateUpdate', stateListener);

        // Retrieve initial state to get player 1's HUB id
        client1.emit('requestState');
        await new Promise(r => setTimeout(r, 200));

        const p1Hub = lastReceivedState?.entities?.find(e => e.owner === 'player1' && e.type === 'HUB');
        expect(p1Hub).toBeDefined();

        // Trigger turn resolution by passing both turns
        client1.emit('passTurn');
        client2.emit('passTurn');

        // Wait 200ms to ensure server's async resolveTurn loop is active and phase is RESOLVING
        await new Promise(r => setTimeout(r, 200));

        // Submit a late action during the resolution phase
        const lateAction = [{
            sourceId: p1Hub.id,
            itemType: 'WEAPON',
            angle: 0,
            distance: 200
        }];
        client1.emit('submitActions', lateAction);

        // Wait for next turn to start
        await new Promise((resolve, reject) => {
            const check = () => {
                if (newTurnStarted) {
                    client1.off('gameStateUpdate', stateListener);
                    resolve();
                } else {
                    setTimeout(check, 100);
                }
            };
            setTimeout(() => {
                client1.off('gameStateUpdate', stateListener);
                reject(new Error('Timeout waiting for next turn to start'));
            }, 6000);
            check();
        });

        // Assert player 1's energy did not deduct the 15 cost of the late weapon (starts at 50, gains 10 income = 60)
        expect(lastReceivedState.players.player1.energy).toBe(60);
    });
});
