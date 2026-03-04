import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as Client } from 'socket.io-client';
import { spawn } from 'child_process';
import path from 'path';

describe('Server Integration - Turn Resolution Race Condition', () => {
    let serverProcess;
    let client1, client2;

    beforeAll(async () => {
        const serverPath = path.resolve(__dirname, 'index.js');
        // Start server on an alternate port
        serverProcess = spawn('node', [serverPath], {
            env: { ...process.env, PORT: '3005' },
            stdio: 'pipe'
        });

        // Wait for server to listen
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Server failed to start in time')), 5000);
            serverProcess.stdout.on('data', (data) => {
                if (data.toString().includes('SERVER RUNNING')) {
                    clearTimeout(timeout);
                    resolve();
                }
            });
            serverProcess.stderr.on('data', (data) => {
                console.error(`SERVER ERR: ${data}`);
            });
        });

        client1 = Client('http://localhost:3005');
        client2 = Client('http://localhost:3005');

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

    it('should prevent double resolution if multiple submit events are sent rapidly', async () => {
        // Setup state to track double turn
        let initialTurn = 0;

        await new Promise(resolve => setTimeout(resolve, 1000)); // wait for initial game state sync

        // Request initial state
        const statePromise = new Promise(resolve => {
            client1.once('gameStateUpdate', state => {
                initialTurn = state.turn;
                resolve(state);
            });
        });

        client1.emit('requestState');
        const state = await statePromise;

        // Find player1's HUB
        const p1Hub = state.entities.find(e => e.owner === 'player1' && e.type === 'HUB');

        // Create a basic valid action (e.g. fire a weapon)
        const actions = [{
            playerId: 'player1',
            type: 'LAUNCH',
            itemType: 'WEAPON', // Costs 10
            sourceId: p1Hub.id,
            sourceX: p1Hub.x,
            sourceY: p1Hub.y,
            angle: 0,
            distance: 100
        }];

        // We want to trigger race condition: 
        // Sync actions
        client1.emit('syncActions', actions);
        await new Promise(resolve => setTimeout(resolve, 50));

        // Let's listen for how many resolutions are started
        let resolutionsStarted = 0;
        client1.on('resolutionStatus', status => {
            if (status.active) resolutionsStarted++;
        });

        // Emit submitActions for player 1
        client1.emit('submitActions', actions);
        // Player 2 submits simultaneously, possibly twice to trigger race!
        client2.emit('submitActions', []);
        client2.emit('submitActions', []);

        // Wait for resolution full process
        await new Promise(resolve => setTimeout(resolve, 2500));

        // Request final state
        const finalState = await new Promise(resolve => {
            client1.once('gameStateUpdate', resolve);
            client1.emit('requestState');
        });

        // Without the lock, resolutionsStarted would be > 1, and turn would have advanced > 1
        expect(resolutionsStarted).toBe(1);
        expect(finalState.turn).toBe(initialTurn + 1);
    }, 10000);
});
