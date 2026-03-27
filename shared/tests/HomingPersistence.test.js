import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';
import { ENTITY_STATS, GLOBAL_STATS } from '../constants/EntityStats.js';

describe('Homing Missile - Target Persistence', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['p1', 'p2']);
        game.map.lakes = [];
        game.map.mountains = [];
    });

    it('should detonate at last known coordinates if target is destroyed mid-flight', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'p1');
        const p2Hub = game.entities.find((e) => e.owner === 'p2');
        p2Hub.hp = 1; // One-hit kill

        p1Hub.x = 100;
        p1Hub.y = 500;
        p2Hub.x = 400;
        p2Hub.y = 500;

        // We'll use a separate Hub for the "destroyer" but place it behind p1Hub so the missile doesn't see it first
        const destroyer = game.addEntity({
            type: 'HUB',
            owner: 'p1',
            x: 0,
            y: 500,
            hp: 10
        });

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
                    distance: 300 // (400 - 0) = 400px. dist 300 = 400px.
                    // Hits p2Hub.
                }
            ],
            p2: []
        };

        const snapshots = game.resolveTurn(actions);

        // Find snapshot where missile locks
        const lockSnap = snapshots.find(
            (s) =>
                s.type === 'ROUND_SUB' &&
                s.state.entities.some((e) => e.itemType === 'HOMING_MISSILE' && e.lockFound)
        );
        expect(lockSnap).toBeDefined();

        // Find detonation
        const detSnap = snapshots.find((s) => {
            // Detonation should happen at Hub.size + 2 (42px) from center
            return (
                s.type === 'ROUND_SUB' &&
                s.state.entities.some((e) => e.type === 'EXPLOSION' && Math.abs(e.x - 400) < 50)
            );
        });

        expect(detSnap).toBeDefined();
    });
});
