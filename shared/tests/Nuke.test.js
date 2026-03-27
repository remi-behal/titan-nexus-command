/**
 * Nuke.test.js
 *
 * Functional tests for the Nuke weapon system.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';
import { ENTITY_STATS, GLOBAL_STATS } from '../constants/EntityStats.js';

describe('Nuke Weapon System', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['p1', 'p2']);
        game.map.lakes = [];
        game.map.mountains = [];
        game.players.p1.energy = 200;

        // Ensure hubs are starters for connection
        game.entities.forEach((e) => {
            if (e.type === 'HUB') e.isStarter = true;
        });
    });

    it('should set correct detonationTurn when launched', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'p1' && e.type === 'HUB');

        const actions = {
            p1: [
                {
                    playerId: 'p1',
                    sourceId: p1Hub.id,
                    itemType: 'NUKE',
                    angle: 0,
                    distance: 100 // Safe distance
                }
            ],
            p2: []
        };

        game.resolveTurn(actions);

        const nuke = game.entities.find((e) => e.type === 'NUKE');
        expect(nuke).toBeDefined();
        // detonationTurn should be 3 (Turn 1 launch + 2)
        expect(nuke.detonationTurn).toBe(3);
    });

    it('should detonate after 2 turns and cause massive damage', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'p1' && e.type === 'HUB');
        const p2Hub = game.entities.find((e) => e.owner === 'p2' && e.type === 'HUB');

        // Position p2Hub far away to avoid landing collision
        p2Hub.x = p1Hub.x + 800; // (250 + 800) = 1050
        p2Hub.y = p1Hub.y;
        p2Hub.hp = 10;

        // Turn 1: Launch
        game.resolveTurn({
            p1: [
                {
                    playerId: 'p1',
                    sourceId: p1Hub.id,
                    itemType: 'NUKE',
                    angle: 0,
                    distance: 150 // Lands at 250 + 263 = 513
                }
            ]
        });

        const nuke = game.entities.find((e) => e.type === 'NUKE');
        expect(nuke).toBeDefined();
        expect(game.turn).toBe(2);

        // Manually position nuke closer to p2Hub so it's in full AOE (radius 200)
        nuke.x = p2Hub.x - 100; // 950. Dist to p2Hub(1050) = 100. < 200 radius.

        // Turn 2: Idle
        game.resolveTurn({ p1: [] });
        expect(game.turn).toBe(3);

        // Turn 3: Start of turn detonation
        const snapshots = game.resolveTurn({ p1: [] });
        expect(game.turn).toBe(4);

        const detSnapshot = snapshots.find((s) => s.type === 'DETONATION');
        expect(detSnapshot).toBeDefined();

        expect(game.entities.find((e) => e.id === nuke.id)).toBeUndefined();
        expect(game.entities.find((e) => e.id === p2Hub.id)).toBeUndefined(); // hub hub hub gone!
    });

    it('should be defused if destroyed before detonationTurn', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'p1' && e.type === 'HUB');

        // Turn 1: Launch
        game.resolveTurn({
            p1: [
                {
                    playerId: 'p1',
                    sourceId: p1Hub.id,
                    itemType: 'NUKE',
                    angle: 0,
                    distance: 150
                }
            ]
        });

        const nuke = game.entities.find((e) => e.type === 'NUKE');
        expect(nuke).toBeDefined();

        // Turn 2: Destroy it
        nuke.hp = 0;
        game.resolveTurn({ p1: [] });

        // Should be gone
        expect(game.entities.find((e) => e.id === nuke.id)).toBeUndefined();

        // Turn 3: Should NOT detonate
        const snapshots = game.resolveTurn({ p1: [] });
        const detSnapshot = snapshots.find((s) => s.type === 'DETONATION');
        expect(detSnapshot).toBeUndefined();
    });

    it('should handle toroidal-wrapped explosion damage', () => {
        // Map size is 2000x2000
        const nuke = game.addEntity({
            type: 'NUKE',
            owner: 'p1',
            x: 1950,
            y: 1000,
            deployed: true
        });
        nuke.detonationTurn = game.turn;

        const target = game.addEntity({ type: 'HUB', owner: 'p2', x: 50, y: 1000, hp: 10 });

        game.resolveTurn({ p1: [] });

        expect(game.entities.find((e) => e.id === target.id)).toBeUndefined();
    });
});
