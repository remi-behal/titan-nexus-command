import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';
import { ENTITY_STATS } from '../constants/EntityStats.js';

describe('GameState - Hazard and Flak Timing Delay', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['p1', 'p2']);
    });

    it('should NOT incinerate a projectile instantly upon touching a nuke hazard', () => {
        const hazardRadius = 200;
        // 1. Manually add a hazard at (1000, 500)
        game.addEntity({
            type: 'EXPLOSION_HAZARD',
            x: 1000,
            y: 500,
            radius: hazardRadius,
            expiresTurn: game.turn,
            deployed: true,
            isHazard: true
        });

        const p1Hub = game.entities.find((e) => e.owner === 'p1');
        p1Hub.x = 900; // 100px from hazard center
        p1Hub.y = 500;

        // Launch a weapon that starts OUTSIDE but enters instantly
        // Wait, if it starts inside, it should also be delayed.
        // Let's launch from far away.
        p1Hub.x = 500;
        p1Hub.y = 500;

        const actions = {
            p1: [{
                playerId: 'p1',
                sourceId: p1Hub.id,
                itemType: 'WEAPON',
                angle: 0,
                distance: 512 // Should reach past the hazard
            }]
        };

        const resultSnapshots = game.resolveTurn(actions);

        // Find the first mention of the projectile in ROUND_SUB snapshots
        // We want to find the tick where it first enters the hazard (radius 200 at x=1000, so edge is at x=800)
        // Hub is at 500. Velocity is 5.
        // Tick 1: x=505, Tick 60: x=800 (Entry!)

        const subSnapshots = resultSnapshots.filter(s => s.type === 'ROUND_SUB');

        // Entry is at Tick 60.
        // At Tick 60, it should definitely still be active (just touched, delay hasn't passed)
        const tick60 = subSnapshots.find(s => s.subTick === 60);
        expect(tick60).toBeDefined();
        const proj60 = tick60.state.entities.find(e => e.type === 'PROJECTILE');
        expect(proj60).toBeDefined();

        // At tick 78, it should definitely be gone (60 + 10 = 70 < 78)
        const tick78 = subSnapshots.find(s => s.subTick === 78);
        if (tick78) {
            const proj78 = tick78.state.entities.find(e => e.type === 'PROJECTILE');
            expect(proj78).toBeUndefined();
        }
    });

    it('should NOT apply flak damage instantly upon entering flak arc', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'p1');
        const p2Hub = game.entities.find((e) => e.owner === 'p2');
        p1Hub.x = 100; p1Hub.y = 300;
        p2Hub.x = 900; p2Hub.y = 300;

        // Setup Flak for P2 at (700, 300)
        const flak = game.addEntity({
            type: 'FLAK_DEFENSE',
            owner: 'p2',
            x: 700,
            y: 300,
            deployed: true,
            fuel: 10
        });

        const actions = {
            p1: [{
                playerId: 'p1',
                sourceId: p1Hub.id,
                itemType: 'WEAPON',
                angle: 0,
                distance: 512
            }]
        };

        const resultSnapshots = game.resolveTurn(actions);
        const subSnapshots = resultSnapshots.filter(s => s.type === 'ROUND_SUB');

        // Entry at tick 90.
        // Tick 96: Should still be active (90 + 5 = 95 or 90 + 10 = 100).
        // Wait, if delay is 5, it dies at 95. If delay is 10, it dies at 100.
        // So at tick 96 it *might* be gone if delay was 5.
        // Let's check tick 90 + early delay.
        const tick90 = subSnapshots.find(s => s.subTick === 90);
        expect(tick90).toBeDefined();
        const proj90 = tick90.state.entities.find(e => e.type === 'PROJECTILE');
        expect(proj90).toBeDefined();

        // Check tick 108: Should definitely be gone.
        const tick108 = subSnapshots.find(s => s.subTick === 108);
        if (tick108) {
            const proj108 = tick108.state.entities.find(e => e.type === 'PROJECTILE');
            expect(proj108).toBeUndefined();
        }
    });
});
