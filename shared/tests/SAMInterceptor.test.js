import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';
import { ENTITY_STATS, GLOBAL_STATS } from '../constants/EntityStats.js';

describe('SAM Interceptor Isolation', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['player1', 'player2']);
        game.map.lakes = [];
        game.map.mountains = [];
    });

    it('should intercept a homing missile and survive (id:215)', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'player1' && e.type === 'HUB');

        const samDefense = game.addEntity({
            type: 'LIGHT_SAM_DEFENSE',
            owner: 'player1',
            x: p1Hub.x + 100,
            y: p1Hub.y,
            deployed: true,
            fuel: 1
        });
        game.addLink(p1Hub.id, samDefense.id, 'player1');

        // Player 2 launches a homing missile
        const actions = {
            player1: [],
            player2: [
                {
                    playerId: 'player2',
                    sourceId: game.entities.find((e) => e.owner === 'player2' && e.type === 'HUB')
                        .id,
                    itemType: 'HOMING_MISSILE',
                    angle: 180,
                    distance: 500
                }
            ]
        };

        const snapshots = game.resolveTurn(actions);

        // Success criteria:
        // 1. The homing missile should be destroyed.
        // 2. The SAM missile should be destroyed (as it detonates on impact).
        // 3. The SAM defense structure should still be active and have HP > 0.
        // 4. IMPORTANT: In isolation, the SAM's own explosion should not destroy the SAM if it detonates "just before" or "at" impact?
        // Wait, if the SAM detonates, it's removed. But the SAM defense structure should be fine.

        let homingMissileIntercepted = false;
        snapshots.forEach((s) => {
            if (s.type === 'ROUND_SUB') {
                const hm = s.state.entities.find(
                    (e) => e.itemType === 'HOMING_MISSILE' && e.owner === 'player2'
                );
                if (!hm || !hm.active) homingMissileIntercepted = true;
            }
        });

        expect(homingMissileIntercepted).toBe(true);

        const samDefenseFinal = game.entities.find(
            (e) => e.type === 'LIGHT_SAM_DEFENSE' && e.owner === 'player1'
        );
        expect(samDefenseFinal).toBeDefined();
        expect(samDefenseFinal.hp).toBeGreaterThan(0);
    });
});
