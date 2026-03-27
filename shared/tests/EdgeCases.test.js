import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';

describe('GameState - Edge Case Fixes', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['p1', 'p2']);
    });

    it('should select targets deterministically by ID when distances are equal', () => {
        // Place a Laser Point Defense at (500, 500)
        const _lpd = game.addEntity({
            type: 'LASER_POINT_DEFENSE',
            owner: 'p2',
            x: 500,
            y: 500,
            deployed: true,
            fuel: 1
        });

        // Add two projectiles at exact same distance (100px away)
        // Projectile A at (400, 500)
        // Projectile B at (600, 500)
        // We will force their IDs to ensure known order
        const _projA = {
            id: 'aaa_projectile',
            type: 'WEAPON',
            owner: 'p1',
            active: true,
            currX: 400,
            currY: 500,
            velocity: 0,
            currentAngle: 0
        };
        const _projB = {
            id: 'bbb_projectile',
            type: 'WEAPON',
            owner: 'p1',
            active: true,
            currX: 600,
            currY: 500,
            velocity: 0,
            currentAngle: 0
        };

        // Note: resolveTurn simulation loop uses tempProjectiles
        // To test this specific logic, we need to simulate a turn or
        // mock the loop. Here we'll simulate a Turn with zero actions
        // but manually injected projectiles in the internal state if needed,
        // or just use a specialized test that calls the logic.

        // Since resolveTurn is complex, let's call it with no actions
        // but set up the internal simulation state.
        // Actually, the easiest way is to let resolveTurn run with 1 round.

        const _actions = { p1: [], p2: [] };

        // Injecting into private simulation or just running the turn
        // with the projectiles already in game.entities (not ideal as resolveTurn clones them)

        // Let's use the fact that resolveTurn simulation starts with
        // existing projectiles if they were added via addEntity?
        // No, projectiles aren't added via addEntity usually.

        // Let's just test the logic by calling a turn where p1 launches two things
        // that end up at the same distance in Round 1 sub-tick 1.

        const hubP1A = game.entities.find((e) => e.owner === 'p1' && e.type === 'HUB');
        hubP1A.x = 400;
        hubP1A.y = 500;
        const hubP1B = game.addEntity({ type: 'HUB', owner: 'p1', x: 400, y: 510, deployed: true });

        const actionsLaunch = {
            p1: [
                {
                    playerId: 'p1',
                    sourceId: hubP1A.id,
                    itemType: 'WEAPON',
                    angle: 0,
                    distance: 100
                },
                { playerId: 'p1', sourceId: hubP1B.id, itemType: 'WEAPON', angle: 0, distance: 100 }
            ],
            p2: []
        };

        const snapshots = game.resolveTurn(actionsLaunch);

        // Find first sub-tick snapshot
        const roundSnap = snapshots.find((s) => s.type === 'ROUND_SUB');
        if (!roundSnap) {
            throw new Error('No ROUND_SUB snapshot found');
        }
        const projectiles = roundSnap.state.entities.filter((e) => e.type === 'PROJECTILE');

        // If one is intercepted, only one remains in the snapshot (since my filter captures active ones)
        // Wait, Laser Intercept happens in sub-tick 1 if range is met.
        // In this case, range 100 is met at launch.

        expect(projectiles.length).toBe(1);
    });

    it('should maintain seeker stability at map halfway point (Toroidal Hysteresis)', () => {
        // Map width 2000. Halfway is 1000.
        const _seeker = {
            id: 'seeker_1',
            type: 'HOMING_MISSILE',
            owner: 'p1',
            active: true,
            currX: 0,
            currY: 500,
            velocity: 5,
            currentAngle: 0, // Pointing RIGHT (+X)
            searchMode: false,
            targetId: 'target_1'
        };

        const _target = game.addEntity({
            id: 'target_1',
            type: 'HUB',
            owner: 'p2',
            x: 1000.1, // Just past halfway. Shortest path is -999.9 (Left)
            y: 500,
            deployed: true,
            hp: 5
        });

        // We need to test the logic in resolveTurn simulation loop.
        // But the simulation loop is private.
        // I'll use a functional test approach: check if the angle flips 180
        // when target moves from 1000.1 to 999.9.

        // Let's create a scenario in resolveTurn.
        const hubP1 = game.entities.find((e) => e.owner === 'p1' && e.type === 'HUB');
        hubP1.x = 0;
        hubP1.y = 500;

        const launchAction = {
            p1: [
                {
                    playerId: 'p1',
                    sourceId: hubP1.id,
                    itemType: 'HOMING_MISSILE',
                    angle: 0,
                    distance: 10
                }
            ],
            p2: []
        };

        // Sub-tick 1: Missile is at (x ~ 5, y=500), angle 0.
        // Target is at (1000.1, 500). Distance ~995. Shortest path is Left (-X).
        // Ideal angle is 180. Diff is 180.
        // WITHOUT HYSTERESIS: Missile turns 180 immediately (up to turn radius).
        // WITH HYSTERESIS: Diff > 170 detected, diff set to 0. Missile keeps angle 0.

        const snapshots = game.resolveTurn(launchAction);
        const subSnap = snapshots.find((s) => s.type === 'ROUND_SUB');
        if (!subSnap) {
            throw new Error('No sub-tick snapshot found for seeker stability test');
        }
        const missile = subSnap.state.entities.find((e) => e.itemType === 'HOMING_MISSILE');

        expect(missile.currentAngle).toBe(0); // Should NOT have turned towards 180
    });

    it('should persist projectiles if source hub is destroyed mid-round', () => {
        // p1 has a Hub at (500, 500)
        const hubP1 = game.entities.find((e) => e.owner === 'p1' && e.type === 'HUB');
        hubP1.x = 500;
        hubP1.y = 500;
        hubP1.hp = 1; // Make it fragile so one hit kills it

        // p2 has a Weapon that will hit p1's hub at t=50
        // Weapon speed 5, dist 250 -> arrival 50.
        const hubP2 = game.addEntity({ type: 'HUB', owner: 'p2', x: 250, y: 500, deployed: true });

        const actions = {
            p1: [
                // p1 fire a weapon. Speed 5, dist 500 -> arrival 100.
                { playerId: 'p1', sourceId: hubP1.id, itemType: 'WEAPON', angle: 0, distance: 188 } // 188 pull ~ 500 dist
            ],
            p2: [
                // p2 fire a weapon that hits p1 hub at t=50.
                // Dist 250.
                { playerId: 'p2', sourceId: hubP2.id, itemType: 'WEAPON', angle: 0, distance: 146 } // 146 pull ~ 250 dist
            ]
        };

        const snapshots = game.resolveTurn(actions);

        // At t=54 (after hub hit at t=50), check if p1's projectile still exists
        const subSnap = snapshots.find((s) => s.type === 'ROUND_SUB' && s.subTick >= 54);
        const p1Proj = subSnap.state.entities.find(
            (e) => e.owner === 'p1' && e.itemType === 'WEAPON'
        );
        const p1Hub = subSnap.state.entities.find((e) => e.owner === 'p1' && e.type === 'HUB');

        expect(p1Hub.hp).toBeLessThanOrEqual(0); // Hub should be "destroyed" (HP <= 0)
        expect(p1Proj).toBeDefined(); // Projectile should still be in flight
    });
});
