import { describe, it, expect } from 'vitest';
import { GameState } from '../GameState.js';

describe('GameState - Target Ambiguity', () => {
    it('should NOT allow standard homing missiles to reacquire a different structure if their target is destroyed mid-flight', () => {
        const game = new GameState();
        game.initializeGame(['p1', 'p2']);

        game.entities = [];
        // Player 1 Hub
        const p1Hub = game.addEntity({
            type: 'HUB',
            x: 100,
            y: 500,
            owner: 'p1',
            deployed: true,
            isStarter: true
        });

        // Player 2 Hub 1 (target, HP = 1)
        const p2Hub1 = game.addEntity({
            type: 'HUB',
            x: 400,
            y: 500,
            owner: 'p2',
            deployed: true,
            hp: 1
        });

        // Player 2 Hub 2 (alternative target, also in range/search cone)
        const p2Hub2 = game.addEntity({
            type: 'HUB',
            x: 400,
            y: 520,
            owner: 'p2',
            deployed: true,
            hp: 10
        });

        // Player 1 Destroyer Hub to destroy Hub 1 early
        const destroyer = game.addEntity({
            type: 'HUB',
            owner: 'p1',
            x: 0,
            y: 500,
            deployed: true,
            hp: 10
        });

        game.players.p1.energy = 1000;
        game.players.p2.energy = 1000;

        // Player 1 launches:
        // 1. A HOMING_MISSILE targeting p2Hub1
        // 2. A regular WEAPON to destroy p2Hub1 early
        const actions = {
            p1: [
                {
                    playerId: 'p1',
                    sourceId: p1Hub.id,
                    itemType: 'HOMING_MISSILE',
                    angle: 0,
                    distance: 180
                },
                {
                    playerId: 'p1',
                    sourceId: destroyer.id,
                    itemType: 'WEAPON',
                    angle: 0,
                    distance: 300 // Arrives early and hits p2Hub1
                }
            ],
            p2: []
        };

        const snapshots = game.resolveTurn(actions);

        // Verification logic:
        // Verify that the HOMING_MISSILE locked onto p2Hub1 initially
        let initialLockOnHub1 = false;
        let reacquiredHub2 = false;

        snapshots.forEach((s) => {
            if (s.state && s.state.entities) {
                s.state.entities.forEach((e) => {
                    if (e.itemType === 'HOMING_MISSILE') {
                        if (e.targetId === p2Hub1.id) {
                            initialLockOnHub1 = true;
                        }
                        if (e.targetId === p2Hub2.id) {
                            reacquiredHub2 = true;
                        }
                    }
                });
            }
        });

        expect(initialLockOnHub1).toBe(true);
        expect(reacquiredHub2).toBe(false); // Must never reacquire Hub 2!

        // Verify that the missile detonated at the last known coordinates of Hub 1
        const detSnap = snapshots.find((s) => {
            return (
                s.type === 'ROUND_SUB' &&
                s.state.entities.some(
                    (e) =>
                        e.type === 'EXPLOSION' &&
                        Math.abs(e.x - 400) < 50 &&
                        Math.abs(e.y - 500) < 20
                )
            );
        });
        expect(detSnap).toBeDefined();
    });
});
