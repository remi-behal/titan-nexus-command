import { describe, it, expect } from 'vitest';
import { GameState } from '../GameState.js';
import { ENTITY_STATS } from '../constants/EntityStats.js';

describe('Explosion Consistency', () => {
    it('should hit a structure if its edge is touching the radius (Surface-to-Surface)', () => {
        const gs = new GameState();
        gs.initializeGame(['p1', 'p2']);
        gs.entities = [];
        // Nuke radiusFull is 200. Hub size is 40.
        // Surface distance = dist - 40.
        // If dist = 240, surface distance is 200. Should HIT full damage.
        const target = gs.addEntity({ id: 't1', type: 'HUB', owner: 'p2', x: 340, y: 100, hp: 10, deployed: true });

        const stats = ENTITY_STATS.NUKE;
        gs.triggerExplosion(100, 100, stats, [], new Set(), gs.entities);

        // dist = 240. Should take full damage (10).
        expect(target.hp).toBe(0);
    });

    it('should hit splash damage if center is outside full but edge is inside half radius', () => {
        const gs = new GameState();
        gs.initializeGame(['p1', 'p2']);
        gs.entities = [];
        // Nuke radiusHalf is 400. Hub size is 40.
        // If dist = 440, surface = 400. Should HIT splash.
        const target = gs.addEntity({ id: 't1', type: 'HUB', owner: 'p2', x: 540, y: 100, hp: 10, deployed: true });

        const stats = ENTITY_STATS.NUKE;
        gs.triggerExplosion(100, 100, stats, [], new Set(), gs.entities);

        // dist = 440. Should take half damage (5).
        expect(target.hp).toBe(5);
    });

    it('should MISS if edge is outside half radius', () => {
        const gs = new GameState();
        gs.initializeGame(['p1', 'p2']);
        gs.entities = [];
        // dist = 441. surface = 401. MISS.
        const target = gs.addEntity({ id: 't1', type: 'HUB', owner: 'p2', x: 541, y: 100, hp: 10, deployed: true });

        const stats = ENTITY_STATS.NUKE;
        gs.triggerExplosion(100, 100, stats, [], new Set(), gs.entities);

        expect(target.hp).toBe(10);
    });
});
