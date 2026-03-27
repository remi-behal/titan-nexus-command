import { describe, it, expect } from 'vitest';
import { GameState } from '../GameState.js';
import { ENTITY_STATS } from '../constants/EntityStats.js';

describe('Napalm Bug Reproduction', () => {
    it('Bug 1: should enforce minRange (blocked < 200px)', () => {
        const gs = new GameState();
        gs.initializeGame(['p1', 'p2']);
        gs.entities = []; // Clear defaults to avoid Link Decay orphans
        gs.addEntity({
            id: 'h1',
            type: 'HUB',
            owner: 'p1',
            x: 100,
            y: 100,
            hp: 5,
            deployed: true,
            isStarter: true
        });

        // Launch with pull distance 10 -> will be clamped to 200 (Min Range).
        // Result: projectile lands at HubX + 50 (due to 150px offset from 200).
        const snapshots = gs.resolveTurn({
            p1: [
                {
                    playerId: 'p1',
                    sourceId: 'h1',
                    itemType: 'NAPALM',
                    angle: 0,
                    distance: 10
                }
            ]
        });

        const impactState = snapshots.find((s) => s.type === 'LANDING');
        expect(impactState).toBeDefined();
        const fire = impactState.state.entities.find((e) => e.type === 'NAPALM_FIRE');

        // Hub(100) + 50 = 150.
        expect(Math.round(fire.x)).toBe(150);
    });

    it('Bug 2: should NOT leave a duplicate NAPALM entity after fire spawns', () => {
        const gs = new GameState();
        gs.initializeGame(['p1', 'p2']);
        gs.entities = [];
        gs.addEntity({
            id: 'h1',
            type: 'HUB',
            owner: 'p1',
            x: 100,
            y: 100,
            hp: 5,
            deployed: true,
            isStarter: true
        });

        const snapshots = gs.resolveTurn({
            p1: [
                {
                    playerId: 'p1',
                    sourceId: 'h1',
                    itemType: 'NAPALM',
                    angle: 0,
                    distance: 100
                }
            ]
        });

        const afterLanding = snapshots.find((s) => s.type === 'LANDING');
        const napalmShell = afterLanding.state.entities.find((e) => e.type === 'NAPALM');
        expect(napalmShell).toBeUndefined();
    });

    it('Bug 3: should apply 2 rounds of damage even in 1-action turns', () => {
        const gs = new GameState();
        gs.initializeGame(['p1', 'p2']);
        gs.entities = [];

        gs.addEntity({
            id: 'h1',
            type: 'HUB',
            owner: 'p1',
            x: 100,
            y: 100,
            hp: 5,
            deployed: true,
            isStarter: true
        });
        gs.addEntity({
            id: 'target',
            type: 'HUB',
            owner: 'p2',
            x: 800,
            y: 100,
            hp: 10,
            deployed: true,
            isStarter: true,
            size: 40
        });

        const snapshots = gs.resolveTurn({
            p1: [
                {
                    playerId: 'p1',
                    sourceId: 'h1',
                    itemType: 'NAPALM',
                    angle: 0,
                    distance: 300
                }
            ]
        });

        // Check snapshots for ROUND 1 and ROUND 2 (since it lands in R1 at tick 33)
        // Wait, arrivalTick for 800px dist is 40?
        // 300 pull -> 800 dist. arrivalTick = 800 / 20 = 40.
        // It lands at tick 40. Round 1 has 200 ticks. So it has plenty of time to tick damage in R1.

        const r1 = snapshots.find((s) => s.type === 'ROUND' && s.round === 1);
        const r2 = snapshots.find((s) => s.type === 'ROUND' && s.round === 2);

        expect(r1).toBeDefined();
        expect(r2).toBeDefined();

        const t1 = r1.state.entities.find((e) => e.id === 'target');
        const t2 = r2.state.entities.find((e) => e.id === 'target');

        expect(t1.hp).toBe(9);
        expect(t2.hp).toBe(8);
    });
});
