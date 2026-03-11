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

    it('should land a FAST (16) weapon at tick 50 when fired 800px', () => {
        const p1Hub = game.entities.find(e => e.owner === 'p1');

        // Mock a FAST weapon launch
        // Dist = 800, Speed = 16 => Arrival = 800 / 16 = 50
        const actions = {
            p1: [{
                playerId: 'p1',
                sourceId: p1Hub.id,
                itemType: 'WEAPON',
                angle: 0,
                distance: 300 // Max pull = 800 launch distance
            }]
        };

        // Inject speed FAST into WEAPON for this test
        ENTITY_STATS.WEAPON.speed = GLOBAL_STATS.SPEED_TIERS.FAST;

        const snapshots = game.resolveTurn(actions);

        // Check if there is a land/explosion at tick 50
        // Our snapshots capture every snapshotStep (which is Math.floor(100/30) = 3)
        // Tick 50 might not be captured, but we can check the FINAL state or logs

        // Actually, we can check for a snapshot near 50 or verify the final state
        const roundSnapshot = snapshots.find(s => s.type === 'ROUND' && s.round === 1);
        expect(roundSnapshot).toBeDefined();

        // If it landed at 50, it should be in the FINAL snapshot of that round
        // Wait, the simulation loop captures ROUND_SUB.
        // Let's check for an explosion in the logs (or we can add a way to check it)

        // For testing, let's verify it hits the target in the final state
        // and that it was active in snapshot 48 and inactive in 51.
        const snap48 = snapshots.find(s => s.type === 'ROUND_SUB' && s.subTick === 48);
        const snap51 = snapshots.find(s => s.type === 'ROUND_SUB' && s.subTick === 51);

        expect(snap48.state.entities.some(e => e.type === 'PROJECTILE')).toBe(true);
        expect(snap51.state.entities.some(e => e.type === 'PROJECTILE')).toBe(false);
    });

    it('should land a SLOW (8) structure at tick 100 when fired 800px', () => {
        const p1Hub = game.entities.find(e => e.owner === 'p1');

        // HUB is Speed 8. Dist = 800 => Arrival = 100
        const actions = {
            p1: [{
                playerId: 'p1',
                sourceId: p1Hub.id,
                itemType: 'HUB',
                angle: 0,
                distance: 300
            }]
        };

        const snapshots = game.resolveTurn(actions);

        // Should be in flight until tick 99
        const snap99 = snapshots.find(s => s.type === 'ROUND_SUB' && s.subTick === 99);
        expect(snap99.state.entities.some(e => e.type === 'PROJECTILE')).toBe(true);

        const finalRound = snapshots.find(s => s.type === 'ROUND' && s.round === 1);
        console.log('Entities in final round:', finalRound.state.entities.map(e => `${e.type}:${e.id} owner:${e.owner}`));
        const landedHub = finalRound.state.entities.find(e => e.owner === 'p1' && e.id !== p1Hub.id);
        expect(landedHub).toBeDefined();
        expect(landedHub.deployed).toBe(true); // Deploys at end of round
    });

    it('should land an early shot at the correct tick (800px @ Speed 10 = Tick 80)', () => {
        const p1Hub = game.entities.find(e => e.owner === 'p1');

        ENTITY_STATS.WEAPON.speed = 10; // NORMAL

        const actions = {
            p1: [{
                playerId: 'p1',
                sourceId: p1Hub.id,
                itemType: 'WEAPON',
                angle: 0,
                distance: 300 // Exactly 800 launch distance
            }]
        };

        const snapshots = game.resolveTurn(actions);

        // 800 / 10 = 80. SnapshotStep 3 means 78 and 81 are captured.
        const snap78 = snapshots.find(s => s.type === 'ROUND_SUB' && s.subTick === 78);
        const snap81 = snapshots.find(s => s.type === 'ROUND_SUB' && s.subTick === 81);

        expect(snap78).toBeDefined();
        expect(snap81).toBeDefined();

        expect(snap78.state.entities.some(e => e.type === 'PROJECTILE')).toBe(true);
        expect(snap81.state.entities.some(e => e.type === 'PROJECTILE')).toBe(false);
    });
});
