import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';
import { ENTITY_STATS, GLOBAL_STATS } from '../constants/EntityStats.js';

describe('Weapon Speed Tiers Verification', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['p1', 'p2']);
        game.map.lakes = [];
        game.map.mountains = [];
    });

    it('should land a speed-8 weapon at tick 100 when fired 800px', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'p1');

        // Mock a speed-8 weapon launch
        // Dist = 800, Speed = 8 => Arrival = 800 / 8 = 100
        const actions = {
            p1: [
                {
                    playerId: 'p1',
                    sourceId: p1Hub.id,
                    itemType: 'WEAPON',
                    angle: 0,
                    distance: 300 // Max pull = 800 launch distance
                }
            ]
        };

        // Inject speed 8 into WEAPON for this test
        ENTITY_STATS.WEAPON.speed = 8;

        const snapshots = game.resolveTurn(actions);

        // Check if there is a land/explosion at tick 100
        // Our snapshots capture every snapshotStep (which is Math.floor(200/30) = 6)
        // Tick 100 might not be captured, but we can check the snapshots near it

        // For testing, let's verify it hits the target in the final state
        // and that it was active in snapshot 96 and inactive in 102.
        const snap96 = snapshots.find((s) => s.type === 'ROUND_SUB' && s.subTick === 96);
        const snap102 = snapshots.find((s) => s.type === 'ROUND_SUB' && s.subTick === 102);

        expect(snap96.state.entities.some((e) => e.type === 'PROJECTILE')).toBe(true);
        expect(snap102.state.entities.some((e) => e.type === 'PROJECTILE')).toBe(false);
    });

    it('should land a SLOW (4) structure at tick 200 when fired 800px', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'p1');

        // HUB is Speed 4. Dist = 800 => Arrival = 200
        const actions = {
            p1: [
                {
                    playerId: 'p1',
                    sourceId: p1Hub.id,
                    itemType: 'HUB',
                    angle: 0,
                    distance: 300
                }
            ]
        };

        const snapshots = game.resolveTurn(actions);

        // Should be in flight until tick 198
        const snap198 = snapshots.find((s) => s.type === 'ROUND_SUB' && s.subTick === 198);
        expect(snap198.state.entities.some((e) => e.type === 'PROJECTILE')).toBe(true);

        const finalRound = snapshots.find((s) => s.type === 'ROUND' && s.round === 1);
        const landedHub = finalRound.state.entities.find(
            (e) => e.owner === 'p1' && e.id !== p1Hub.id
        );
        expect(landedHub).toBeDefined();
        expect(landedHub.deployed).toBe(true); // Deploys at end of round
    });

    it('should land an early shot at the correct tick (800px @ Speed 5 = Tick 160)', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'p1');

        ENTITY_STATS.WEAPON.speed = 5; // NORMAL

        const actions = {
            p1: [
                {
                    playerId: 'p1',
                    sourceId: p1Hub.id,
                    itemType: 'WEAPON',
                    angle: 0,
                    distance: 300 // Exactly 800 launch distance
                }
            ]
        };

        const snapshots = game.resolveTurn(actions);

        // 800 / 5 = 160. SnapshotStep 6 means 156 and 162 are captured.
        const snap156 = snapshots.find((s) => s.type === 'ROUND_SUB' && s.subTick === 156);
        const snap162 = snapshots.find((s) => s.type === 'ROUND_SUB' && s.subTick === 162);

        expect(snap156).toBeDefined();
        expect(snap162).toBeDefined();

        expect(snap156.state.entities.some((e) => e.type === 'PROJECTILE')).toBe(true);
        expect(snap162.state.entities.some((e) => e.type === 'PROJECTILE')).toBe(false);
    });
});
