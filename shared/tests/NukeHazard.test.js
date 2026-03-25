import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';
import { ENTITY_STATS, GLOBAL_STATS } from '../constants/EntityStats.js';

describe('Nuke Lingering Hazard', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['p1', 'p2']);
        game.map.lakes = [];
        game.map.mountains = [];
        game.players.p1.energy = 500;
    });

    it('should spawn a lingering hazard upon nuke detonation', () => {
        const hub = game.entities.find(e => e.owner === 'p1');
        // Setup a nuke destined to detonate this turn
        game.addEntity({ type: 'NUKE', owner: 'p1', x: 500, y: 500, detonationTurn: game.turn });

        game.resolveTurn({ p1: [] });

        const hazard = game.entities.find(e => e.type === 'EXPLOSION_HAZARD');
        expect(hazard).toBeDefined();
        expect(hazard.x).toBe(500);
        expect(hazard.y).toBe(500);
        expect(hazard.expiresTurn).toBe(game.turn - 1); // Turn 1 detachment spawn -> Turn 2 cleanup. expiresTurn is Turn it existed in.
    });

    it('should destroy a projectile flying THROUGH the hazard path', () => {
        const hazardRadius = ENTITY_STATS.EXPLOSION_HAZARD.radius;
        // 1. Manually add a hazard at (1000, 500)
        game.addEntity({ type: 'EXPLOSION_HAZARD', x: 1000, y: 500, radius: hazardRadius, expiresTurn: game.turn });

        // 2. Launch a weapon from (500, 500) directed at (1500, 500)
        // Path crosses center
        const p1Hub = game.entities.find(e => e.owner === 'p1');
        p1Hub.x = 500;
        p1Hub.y = 500;

        const p2Hub = game.entities.find(e => e.owner === 'p2');
        p2Hub.x = 1500; // Target
        p2Hub.y = 500;

        const actions = {
            p1: [{
                playerId: 'p1',
                sourceId: p1Hub.id,
                itemType: 'WEAPON',
                angle: 0,
                distance: 512 // Maps to around 1000px launch.
            }]
        };

        const resultSnapshots = game.resolveTurn(actions);
        const finalState = resultSnapshots[resultSnapshots.length - 1].state;

        // Target hub should NOT have taken damage because projectile path intersects nuke hazard
        const target = finalState.entities.find(e => e.id === p2Hub.id);
        expect(target.hp).toBe(ENTITY_STATS.HUB.hp);
    });

    it('should damage structures that stay inside the hazard each round', () => {
        const p2Hub = game.entities.find(e => e.owner === 'p2');
        p2Hub.x = 500;
        p2Hub.y = 500;
        p2Hub.hp = 10;

        // Manually add a hazard lasting this turn
        game.addEntity({ type: 'EXPLOSION_HAZARD', x: 510, y: 500, owner: 'p1', expiresTurn: game.turn });

        game.resolveTurn({ p1: [] });

        // p2Hub is at 500,500. Hazard at 510,500 with radius 200.
        // It stays in it for 1 round (optimized from 5).
        // Initial detonation is NOT triggered here (manually added hazard), 
        // but round-by-round damage should be applied.
        // 10 HP - 1 dmg * 1 round = 9 HP.
        const target = game.entities.find(e => e.id === p2Hub.id);
        expect(target.hp).toBe(9);
    });

    it('should leave a crater after the hazard subsided', () => {
        game.addEntity({ type: 'EXPLOSION_HAZARD', x: 1000, y: 500, expiresTurn: game.turn - 1 });

        // Start next turn. resolveTurn should cleanup the hazard and leave a crater.
        game.resolveTurn({ p1: [] });

        expect(game.entities.find(e => e.type === 'EXPLOSION_HAZARD')).toBeUndefined();
        expect(game.map.craters).toBeDefined();
        expect(game.map.craters.length).toBe(1);
        expect(game.map.craters[0].x).toBe(1000);
        expect(game.map.craters[0].y).toBe(500);
    });
});
