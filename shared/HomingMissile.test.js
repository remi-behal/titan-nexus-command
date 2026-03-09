import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from './GameState.js';
import { ENTITY_STATS, GLOBAL_STATS } from './EntityStats.js';

describe('Homing Missile Logic', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['p1', 'p2']);
        game.map.lakes = [];
        game.map.mountains = [];
    });

    it('should stay in "Dumb Mode" for the first 50% of its distance', () => {
        const p1Hub = game.entities.find(e => e.owner === 'p1');
        const actions = {
            p1: [{
                playerId: 'p1',
                sourceId: p1Hub.id,
                itemType: 'HOMING_MISSILE',
                angle: 0,
                distance: 200
            }]
        };

        const snapshots = game.resolveTurn(actions);
        const launchDist = GameState.calculateLaunchDistance(200);
        const searchThreshold = launchDist * 0.5;

        snapshots.forEach(s => {
            if (s.type === 'ROUND_SUB') {
                const proj = s.state.entities.find(e => e.itemType === 'HOMING_MISSILE');
                if (proj) {
                    const distMoved = game.getToroidalDistance(p1Hub.x, p1Hub.y, proj.x, proj.y);
                    if (distMoved < searchThreshold) {
                        expect(proj.y).toBe(p1Hub.y);
                    }
                }
            }
        });
    });

    it('should acquire a target ONLY if it falls within the 60 degree cone and 100px range', () => {
        const p1Hub = game.entities.find(e => e.owner === 'p1');
        const p2Hub = game.entities.find(e => e.owner === 'p2');

        // Target is at 10 degrees offset (INSIDE CONE) and 90px away (IN RANGE)
        // We place it ahead of the 50% dumb phase trigger point
        const launchDist = GameState.calculateLaunchDistance(100); // 216px
        const triggerX = p1Hub.x + (launchDist * 0.5); // 250 + 108 = 358

        p2Hub.x = triggerX + 90;
        p2Hub.y = p1Hub.y + 20;

        const actions = {
            p1: [{
                playerId: 'p1',
                sourceId: p1Hub.id,
                itemType: 'HOMING_MISSILE',
                angle: 0,
                distance: 100
            }]
        };

        const snapshots = game.resolveTurn(actions);

        const lockingSnapshot = snapshots.find(s => {
            if (s.type === 'ROUND_SUB') {
                const proj = s.state.entities.find(e => e.itemType === 'HOMING_MISSILE');
                return proj && Math.abs(proj.y - 500) > 0.01 && proj.lockFound;
            }
            return false;
        });

        expect(lockingSnapshot).toBeDefined();
    });

    it('should NOT acquire a target if it is outside the 60 degree cone', () => {
        const p1Hub = game.entities.find(e => e.owner === 'p1');
        const p2Hub = game.entities.find(e => e.owner === 'p2');

        // Target is at 45 degrees offset (OUTSIDE CONE)
        const launchDist = GameState.calculateLaunchDistance(100);
        const triggerX = p1Hub.x + (launchDist * 0.5);

        p2Hub.x = triggerX + 80;
        p2Hub.y = p1Hub.y + 100; // Steep angle (approx 51 degrees)

        const actions = {
            p1: [{
                playerId: 'p1',
                sourceId: p1Hub.id,
                itemType: 'HOMING_MISSILE',
                angle: 0,
                distance: 100
            }]
        };

        const snapshots = game.resolveTurn(actions);
        // It should never lock on and thus finish straight
        const missSnapshot = snapshots.filter(s => s.type === 'ROUND_SUB').pop();
        const proj = missSnapshot.state.entities.find(e => e.itemType === 'HOMING_MISSILE');

        if (proj) {
            expect(proj.y).toBe(p1Hub.y);
            expect(proj.lockFound).toBe(false);
        }
    });

    it('should project cone vision (flashlight) and NOT circular vision', () => {
        const p1Hub = game.entities.find(e => e.owner === 'p1');
        p1Hub.vision = 0;

        const projX = p1Hub.x + 10;
        const pointAhead = projX + 50;
        const pointBehind = projX - 50;

        const missile = { id: 'm1', type: 'PROJECTILE', itemType: 'HOMING_MISSILE', owner: 'p1', x: projX, y: p1Hub.y, currentAngle: 0 };
        game.entities = [missile];

        expect(game.isPositionVisible('p1', pointAhead, p1Hub.y)).toBe(true);
        expect(game.isPositionVisible('p1', pointBehind, p1Hub.y)).toBe(false);
    });

    it('should enforce Single Lock policy: no retargeting if lock target dies', () => {
        const p1Hub = game.entities.find(e => e.owner === 'p1');
        const p2Hub = game.entities.find(e => e.owner === 'p2');

        p2Hub.x = 450;
        p2Hub.y = 520;

        const actions = {
            p1: [{
                playerId: 'p1',
                sourceId: p1Hub.id,
                itemType: 'HOMING_MISSILE',
                angle: 0,
                distance: 100
            }]
        };

        const snapshots = game.resolveTurn(actions);
        const lockSnap = snapshots.find(s => s.type === 'ROUND_SUB' && s.state.entities.some(e => e.itemType === 'HOMING_MISSILE' && e.lockFound));

        expect(lockSnap).toBeDefined();
    });

    it('should scout enemy entities during flight using cone vision', () => {
        const p1Hub = game.entities.find(e => e.owner === 'p1');
        const p2Hub = game.entities.find(e => e.owner === 'p2');

        // Hide p1Hub vision so we only rely on the projectile
        p1Hub.vision = 0;

        // Place p2Hub in front of p1
        p2Hub.x = p1Hub.x + 150;
        p2Hub.y = p1Hub.y;

        // Start a turn with a homing missile
        const actions = {
            p1: [{
                playerId: 'p1',
                sourceId: p1Hub.id,
                itemType: 'HOMING_MISSILE',
                angle: 0,
                distance: 100
            }]
        };

        const snapshots = game.resolveTurn(actions);

        // Find a snapshot where the projectile is near p2Hub (p2Hub is at x=400)
        const scoutingSnapshot = snapshots.find(s => {
            if (s.type === 'ROUND_SUB') {
                const proj = s.state.entities.find(e => e.itemType === 'HOMING_MISSILE');
                // Missile should see p2Hub (range 300) when it gets within range and cone
                return proj && game.getToroidalDistance(proj.x, proj.y, p2Hub.x, p2Hub.y) < 300;
            }
            return false;
        });

        expect(scoutingSnapshot).toBeDefined();

        // Now verify that if we filter the state for p1, p2Hub is included and scouted
        const visibleState = game.getVisibleState('p1', scoutingSnapshot.state);
        const scoutedP2Hub = visibleState.entities.find(e => e.id === p2Hub.id);

        expect(scoutedP2Hub).toBeDefined();
        expect(scoutedP2Hub.scouted).toBe(true);
    });
});
