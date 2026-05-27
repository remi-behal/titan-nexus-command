import { describe, it, expect } from 'vitest';
import { GameState } from '../GameState.js';
import { CollisionSystem } from '../systems/CollisionSystem.js';
import { ProjectileSystem } from '../systems/ProjectileSystem.js';

describe('Modular Systems Verification', () => {
    it('should export stateless helper namespaces', () => {
        expect(CollisionSystem).toBeDefined();
        expect(CollisionSystem.checkShieldInterception).toBeTypeOf('function');
        expect(CollisionSystem.checkHazardCollision).toBeTypeOf('function');

        expect(ProjectileSystem).toBeDefined();
        expect(ProjectileSystem.updateSeekerProjectile).toBeTypeOf('function');
        expect(ProjectileSystem.updateStandardProjectile).toBeTypeOf('function');
    });

    it('should execute standard linear projectile simulation steps correctly via systems', () => {
        const gameState = new GameState();
        gameState.map.width = 2000;
        gameState.map.height = 2000;

        const proj = {
            id: 'test-linear-proj',
            type: 'WEAPON',
            owner: 'player1',
            startX: 100,
            startY: 100,
            currX: 100,
            currY: 100,
            intendedDx: 400,
            intendedDy: 300,
            arrivalTick: 100,
            active: true,
            hitThisTick: false,
            scheduledEffects: []
        };

        const tempProjectiles = [proj];
        const tempVisuals = [];
        const impacts = [];
        const overloadedThisRound = new Set();
        const snapshots = [];

        // Tick 50 (midway)
        ProjectileSystem.updateStandardProjectile(
            gameState,
            proj,
            50,
            1,
            tempProjectiles,
            tempVisuals,
            impacts,
            overloadedThisRound,
            snapshots
        );

        // Intended dx/dy is 400/300. Progress at t=50 (50/100 = 0.5) should place it at start + 200/150 = 300/250
        expect(proj.currX).toBe(300);
        expect(proj.currY).toBe(250);
        expect(proj.active).toBe(true);

        // Tick 100 (arrival)
        ProjectileSystem.updateStandardProjectile(
            gameState,
            proj,
            100,
            1,
            tempProjectiles,
            tempVisuals,
            impacts,
            overloadedThisRound,
            snapshots
        );

        expect(proj.currX).toBe(500);
        expect(proj.currY).toBe(400);
        expect(proj.active).toBe(false);
        expect(proj.hitThisTick).toBe(false); // Detonates on arrival
    });
});
