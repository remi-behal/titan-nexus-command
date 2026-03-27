import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';
import { ENTITY_STATS, GLOBAL_STATS } from '../constants/EntityStats.js';

describe('GameState - AOE Damage Refinement', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['p1', 'p2']);
        game.map.lakes = [];
        game.map.mountains = [];
    });

    it('should deal full damage to large structures if hit is near the edge (Surface-to-Surface)', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'p1');
        const p2Hub = game.entities.find((e) => e.owner === 'p2');

        // HUB size is 40. We hit at 35px from center.
        p2Hub.x = 500;
        p2Hub.y = 500;
        p1Hub.x = 500;
        p1Hub.y = 500;

        const actions = {
            p1: [
                {
                    playerId: 'p1',
                    sourceId: p1Hub.id,
                    itemType: 'WEAPON',
                    angle: 0, // RIGHT
                    distance: 0
                }
            ],
            p2: []
        };

        // We want the weapon to land at (535, 500).
        // Since it's fired from (500, 500), distance should be 35.
        const pullDistance =
            Math.pow(35 / GLOBAL_STATS.MAX_LAUNCH, 1 / GLOBAL_STATS.POWER_EXPONENT) *
            GLOBAL_STATS.MAX_PULL;
        actions.p1[0].distance = pullDistance;

        game.resolveTurn(actions);

        const hubAfter = game.entities.find((e) => e.id === p2Hub.id);
        // Distance is 35. HUB size 40.
        // Surface distance is 35-40 = -5. (Hitting the side)
        expect(hubAfter.hp).toBe(ENTITY_STATS.HUB.hp - ENTITY_STATS.WEAPON.damageFull);
    });
});
