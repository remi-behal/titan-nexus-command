import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { validateActions } from './utils/ActionValidator.js';
import { io as Client } from 'socket.io-client';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

describe('Server - Action Validation', () => {
    const game = {
        turn: 1,
        players: {
            player1: { energy: 50 },
            player2: { energy: 10 }
        },
        entities: [
            { id: 'hub-p1', type: 'HUB', owner: 'player1', fuel: 2 },
            { id: 'hub-p2', type: 'HUB', owner: 'player2', fuel: 1 },
            { id: 'hub-emp', type: 'HUB', owner: 'player1', fuel: 1, disabledUntilTurn: 2 }
        ]
    };

    it('should accept valid actions', () => {
        const actions = [
            { sourceId: 'hub-p1', itemType: 'HUB', distance: 100, angle: 0 }
        ];
        const validated = validateActions(actions, 'player1', game);
        expect(validated.length).toBe(1);
        expect(validated[0].sourceId).toBe('hub-p1');
    });

    it('should reject actions from entities not owned by the player', () => {
        const actions = [
            { sourceId: 'hub-p2', itemType: 'HUB', distance: 100, angle: 0 }
        ];
        const validated = validateActions(actions, 'player1', game);
        expect(validated.length).toBe(0);
    });

    it('should reject actions if player has insufficient energy', () => {
        const actions = [
            { sourceId: 'hub-p1', itemType: 'HUB', distance: 100, angle: 0 },
            { sourceId: 'hub-p1', itemType: 'HUB', distance: 100, angle: 0 },
            { sourceId: 'hub-p1', itemType: 'HUB', distance: 100, angle: 0 }
        ];
        const validated = validateActions(actions, 'player1', game);
        expect(validated.length).toBe(2); // First 2 cost 40 (energy is 50, 3rd exceeds energy limit)
    });

    it('should reject actions exceeding source entity fuel limit', () => {
        const actions = [
            { sourceId: 'hub-p1', itemType: 'HUB', distance: 100, angle: 0 },
            { sourceId: 'hub-p1', itemType: 'HUB', distance: 100, angle: 0 },
            { sourceId: 'hub-p1', itemType: 'HUB', distance: 100, angle: 0 }
        ];
        // Ensure game energy is updated for this subtest so fuel limit triggers first
        const gameWithMoreEnergy = {
            ...game,
            players: { player1: { energy: 100 } }
        };
        const validated = validateActions(actions, 'player1', gameWithMoreEnergy);
        expect(validated.length).toBe(2); // Limited by hub-p1 fuel = 2
    });

    it('should reject actions from source entity disabled by EMP', () => {
        const actions = [
            { sourceId: 'hub-emp', itemType: 'HUB', distance: 100, angle: 0 }
        ];
        const validated = validateActions(actions, 'player1', game);
        expect(validated.length).toBe(0);
    });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Server Integration - Action Validation Sockets', () => {
    let serverProcess;
    let client1, client2;

    beforeAll(async () => {
        const serverPath = path.resolve(__dirname, 'index.js');
        serverProcess = spawn('node', [serverPath], {
            env: {
                ...process.env,
                PORT: '3112',
                RESOLUTION_ROUND_DELAY: '10',
                RESOLUTION_SUB_TICK_DELAY: '2'
            },
            stdio: 'pipe'
        });
        serverProcess.stdout.on('data', (data) => {
            console.log('[Spawned Server]', data.toString().trim());
        });
        serverProcess.stderr.on('data', (data) => {
            console.error('[Spawned Server Error]', data.toString().trim());
        });

        await new Promise((resolve) => setTimeout(resolve, 1000));
        client1 = Client('http://localhost:3112');
        client2 = Client('http://localhost:3112');

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Auth timeout')), 10000);
            let authenticated = 0;
            const onAuth = () => {
                if (++authenticated === 2) {
                    clearTimeout(timeout);
                    resolve();
                }
            };
            client1.on('playerAssignment', onAuth);
            client2.on('playerAssignment', onAuth);
            client1.emit('authenticate', 'val-token-p1');
            client2.emit('authenticate', 'val-token-p2');
        });

        // Lobby Handshake
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Lobby handshake')), 10000);
            client1.once('matchStarted', () => {
                clearTimeout(timeout);
                resolve();
            });
            client1.emit('lobby:claimSeat', 0);
            client2.emit('lobby:claimSeat', 1);
            setTimeout(() => {
                client1.emit('lobby:ready', true);
                client2.emit('lobby:ready', true);
            }, 300);
        });
    }, 30000);

    afterAll(async () => {
        client1?.disconnect();
        client2?.disconnect();
        serverProcess?.kill('SIGKILL');
        await new Promise((r) => setTimeout(r, 200));
    });

    it('should reject invalid actions submitted via sockets', async () => {
        // Retrieve start state
        let state = await new Promise((resolve) => {
            client1.once('gameStateUpdate', resolve);
            client1.emit('requestState');
        });

        const p1Hub = state.entities.find(e => e.owner === 'player1');

        // Submit actions: one valid (correct hub), one invalid (wrong owner/target)
        client1.emit('submitActions', [
            { sourceId: p1Hub.id, itemType: 'HUB', angle: 45, distance: 300 }, // Valid
            { sourceId: 'fake-id-123', itemType: 'HUB', angle: 45, distance: 300 } // Invalid
        ]);
        client2.emit('submitActions', []);

        // Wait for turn to resolve
        await new Promise((resolve) => {
            client1.on('gameStateUpdate', function listener(newState) {
                if (newState.turn === 2) {
                    client1.off('gameStateUpdate', listener);
                    resolve();
                }
            });
        });

        // Verify state
        state = await new Promise((resolve) => {
            client1.once('gameStateUpdate', resolve);
            client1.emit('requestState');
        });

        // The valid hub action should have created a second hub, but the invalid action should have done nothing
        const playerHubs = state.entities.filter(e => e.owner === 'player1' && (e.itemType === 'HUB' || e.type === 'HUB'));
        expect(playerHubs.length).toBe(2);
    }, 20000);
});
