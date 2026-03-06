import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from './GameState.js';
import { ENTITY_STATS } from './EntityStats.js';

describe('GameState - Structure Overlap (Rule A)', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['p1', 'p2']);
    });

    it('should destroy two hubs launched to the same spot in the same round', () => {
        const p1Hub = game.entities.find(e => e.owner === 'p1' && e.type === 'HUB');
        const p2Hub = game.entities.find(e => e.owner === 'p2' && e.type === 'HUB');

        // Note: Real launches use complex math but for the unit test 
        // we'll manually instantiate the entities in their "landed but undeployed" state.

        // Radius of HUB is 40. Dist between (1000,1000) and (1005,1005) is ~7. 
        // 7 < (40 + 40), so they MUST collide.
        const h1 = game.addEntity({ type: 'HUB', owner: 'p1', x: 1000, y: 1000, deployed: false, hp: 1 });
        const h2 = game.addEntity({ type: 'HUB', owner: 'p2', x: 1005, y: 1005, deployed: false, hp: 1 });

        game.checkStructureCollisions();

        expect(game.entities.find(e => e.id === h1.id).hp).toBe(0);
        expect(game.entities.find(e => e.id === h2.id).hp).toBe(0);
    });

    it('should destroy new hub landing on existing hub and damage old one (Rule B)', () => {
        // Starter hub is at (250, 500), radius 40
        const starter = game.entities.find(e => e.isStarter && e.owner === 'p1');

        // Land a new hub on top of it (250, 505) - distance 5 < (40+40)
        const newHub = game.addEntity({ type: 'HUB', owner: 'p2', x: 250, y: 505, deployed: false, hp: 1 });

        game.checkStructureCollisions();

        // New hub should be destroyed
        expect(game.entities.find(e => e.id === newHub.id).hp).toBe(0);
        // Existing hub should take 1 damage (5 HP -> 4 HP)
        expect(game.entities.find(e => e.id === starter.id).hp).toBe(ENTITY_STATS.HUB.hp - 1);
    });
});
