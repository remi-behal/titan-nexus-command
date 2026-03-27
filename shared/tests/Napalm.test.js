import { describe, it, expect } from 'vitest';
import { GameState } from '../GameState.js';
import { ENTITY_STATS, GLOBAL_STATS } from '../constants/EntityStats.js';

describe('Napalm Weapon Mechanics (Refined)', () => {
    it('should fly 150px short of target and extend fire forward', () => {
        const gs = new GameState();
        gs.initializeGame(['p1', 'p2']);

        // p1 Hub at (100, 100)
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

        // Launch with pull distance 300 (Max Pull) -> actual distance 800 (Max Launch)
        const pull = 300;
        const _expectedLaunchDist = 800; // Correct based on EntityStats/calculateLaunchDistance

        const snapshots = gs.resolveTurn({
            p1: [
                {
                    playerId: 'p1',
                    sourceId: 'h1',
                    itemType: 'NAPALM',
                    angle: 0,
                    distance: pull
                }
            ]
        });

        // The fire is gone by the end of resolveTurn, so we must check snapshots
        const impactState = snapshots.find((s) =>
            s.state.entities.some((e) => e.type === 'NAPALM_FIRE')
        );
        expect(impactState).toBeDefined();

        const fire = impactState.state.entities.find((e) => e.type === 'NAPALM_FIRE');
        expect(fire).toBeDefined();

        // Target = (100 + 800, 100) = (900, 100)
        // Impact (Base) = (900 - 150, 100) = (750, 100)
        expect(Math.round(fire.x)).toBe(750);
        expect(Math.round(fire.y)).toBe(100);

        // Fire should extend FORWARDS to the original target (900)
        expect(Math.round(fire.startX)).toBe(750);
        expect(Math.round(fire.startY)).toBe(100);
        expect(Math.round(fire.endX)).toBe(900);
        expect(Math.round(fire.endY)).toBe(100);
    });

    it('should damage structures if only touching (target radius included)', () => {
        const gs = new GameState();
        gs.initializeGame(['p1', 'p2']);

        // Fire from (200, 100) to (350, 100). Width 30 (radius 15).
        // target1 logic: dist to line is 50. hub radius is 40. 50 <= 15+40 (55) -> HIT
        // target2 logic: dist to line is 60. hub radius is 40. 60 > 15+40 (55) -> MISS
        gs.entities = [
            {
                id: 'f1',
                type: 'NAPALM_FIRE',
                x: 200,
                y: 100,
                startX: 200,
                startY: 100,
                endX: 350,
                endY: 100,
                roundsLeft: 2,
                isHazard: true
            },
            {
                id: 'target1',
                type: 'HUB',
                owner: 'p2',
                x: 400,
                y: 100,
                hp: 5,
                deployed: true,
                isStarter: true,
                size: 40
            },
            {
                id: 'target2',
                type: 'HUB',
                owner: 'p2',
                x: 410,
                y: 100,
                hp: 5,
                deployed: true,
                isStarter: true,
                size: 40
            }
        ];
        // Ensure they aren't orphaned by linking them
        gs.links = [{ from: 'target1', to: 'target2', owner: 'p2' }];

        gs.resolveTurn({ p1: [], p2: [] });

        const t1 = gs.entities.find((e) => e.id === 'target1');
        const t2 = gs.entities.find((e) => e.id === 'target2');

        expect(t1).toBeDefined();
        expect(t1.hp).toBe(3); // Damaged twice (Round 1 + Round 2)
        expect(t2).toBeDefined();
        expect(t2.hp).toBe(5); // Safe (too far)
    });

    it('should apply damage twice if turn has 2 rounds', () => {
        const gs = new GameState();
        gs.initializeGame(['p1', 'p2']);

        gs.entities = [
            {
                id: 'h_src',
                type: 'HUB',
                owner: 'p1',
                x: 100,
                y: 100,
                hp: 5,
                deployed: true,
                isStarter: true,
                fuel: 10
            },
            {
                id: 'f1',
                type: 'NAPALM_FIRE',
                x: 200,
                y: 100,
                startX: 200,
                startY: 100,
                endX: 350,
                endY: 100,
                roundsLeft: 2,
                isHazard: true
            },
            {
                id: 'target1',
                type: 'HUB',
                owner: 'p2',
                x: 250,
                y: 100,
                hp: 5,
                deployed: true,
                isStarter: true,
                size: 40
            }
        ];

        // 2 actions for hub h_src should trigger 2 rounds
        gs.resolveTurn({
            p1: [
                { playerId: 'p1', sourceId: 'h_src', itemType: 'WEAPON', angle: 0, distance: 10 },
                { playerId: 'p1', sourceId: 'h_src', itemType: 'WEAPON', angle: 0, distance: 10 }
            ]
        });

        const t1 = gs.entities.find((e) => e.id === 'target1');
        expect(t1.hp).toBe(3); // 5 - 2 damage (one per round)
    });

    it('should expire at end of turn even if rounds remain', () => {
        const gs = new GameState();
        gs.initializeGame(['p1', 'p2']);

        gs.addEntity({
            id: 'f1',
            type: 'NAPALM_FIRE',
            x: 200,
            y: 100,
            startX: 200,
            startY: 100,
            endX: 350,
            endY: 100,
            roundsLeft: 5,
            isHazard: true
        });

        gs.resolveTurn({ p1: [], p2: [] });
        expect(gs.entities.find((e) => e.id === 'f1')).toBeUndefined();
    });
});
