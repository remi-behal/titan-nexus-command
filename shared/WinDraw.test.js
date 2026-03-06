import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from './GameState.js';
import { ENTITY_STATS } from './EntityStats.js';

describe('GameState - Win/Draw Conditions', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['p1', 'p2']);
    });

    it('should result in a DRAW if both hubs are destroyed in the same round', () => {
        const p1Hub = game.entities.find(e => e.owner === 'p1' && e.type === 'HUB');
        const p2Hub = game.entities.find(e => e.owner === 'p2' && e.type === 'HUB');

        // Move them close for easy targeting
        // p1Hub at (250,500), p2Hub at (550,500)
        p1Hub.x = 250; p1Hub.y = 500;
        p2Hub.x = 550; p2Hub.y = 500;

        // Both fire weapons at each other (deals 2 damage, hubs have 5)
        p1Hub.hp = 1;
        p2Hub.hp = 1;

        // Both fire weapons at each other
        // Dist 300, weapon reaches ~310 with default launch speed/drag params
        const actions = {
            p1: [{ playerId: 'p1', sourceId: p1Hub.id, itemType: 'WEAPON', angle: 0, distance: 160 }],
            p2: [{ playerId: 'p2', sourceId: p2Hub.id, itemType: 'WEAPON', angle: 180, distance: 160 }]
        };

        game.resolveTurn(actions);

        expect(game.winner).toBe('DRAW');
        expect(game.players['p1'].alive).toBe(false);
        expect(game.players['p2'].alive).toBe(false);
    });

    it('should result in a DRAW if all players lose all their hubs by the end of the turn (even in different rounds)', () => {
        const p1Hub = game.entities.find(e => e.owner === 'p1' && e.type === 'HUB');
        const p2Hub1 = game.entities.find(e => e.owner === 'p2' && e.type === 'HUB');

        // Add a second hub for P2 so they can survive Round 1 and strike back in Round 2
        const p2Hub2 = game.addEntity({ type: 'HUB', owner: 'p2', x: 800, y: 500, deployed: true, hp: 1 });

        p1Hub.x = 250; p1Hub.y = 500; p1Hub.hp = 1;
        p2Hub1.x = 550; p2Hub1.y = 500; p2Hub1.hp = 1;

        // Round 1: P1 kills P2's Hub 1.
        // Round 2: P2's Hub 2 kills P1's Only Hub.
        // Round 3: P1 has no actions, so we'll just have P1 die.
        // Wait, how does P2 die completely? Let's have p1 fire two weapons.
        // Round 1: P1 fires at P2-Hub1.
        // Round 2: P1 fires at P2-Hub2. P2-Hub2 fires at P1-Hub.

        const actions = {
            p1: [
                { playerId: 'p1', sourceId: p1Hub.id, itemType: 'WEAPON', angle: 0, distance: 162 }, // Hits P2-Hub1 (550) in R1
                { playerId: 'p1', sourceId: p1Hub.id, itemType: 'WEAPON', angle: 0, distance: 237 }  // Hits P2-Hub2 (800) in R2
            ],
            p2: [
                { playerId: 'p2', sourceId: p2Hub1.id, itemType: 'EXTRACTOR', angle: 90, distance: 50 }, // Filler R1
                { playerId: 'p2', sourceId: p2Hub2.id, itemType: 'WEAPON', angle: 180, distance: 237 } // Hits P1-Hub (250) in R2
            ]
        };

        game.resolveTurn(actions);

        expect(game.winner).toBe('DRAW');
        expect(game.players['p1'].alive).toBe(false);
        expect(game.players['p2'].alive).toBe(false);
    });
});
