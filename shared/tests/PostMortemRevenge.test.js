import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';

describe('GameState - Post-Mortem Revenge', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['p1', 'p2']);
    });

    it('should allow launched projectiles to complete their flight paths and damage targets even if the firing player hub is destroyed earlier in the same turn', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'p1' && e.type === 'HUB');
        const p2Hub1 = game.entities.find((e) => e.owner === 'p2' && e.type === 'HUB');

        // Position hubs:
        // P1 Hub at (200, 500)
        p1Hub.x = 200;
        p1Hub.y = 500;
        p1Hub.hp = 1; // 1 HP so it dies in one hit

        // P2 Hub 1 at (500, 500) - distance 300px from P1
        p2Hub1.x = 500;
        p2Hub1.y = 500;
        p2Hub1.hp = 1; // 1 HP so it dies in one hit

        // P2 Hub 2 at (900, 500) - distance 700px from P1
        const p2Hub2 = game.addEntity({
            type: 'HUB',
            owner: 'p2',
            x: 900,
            y: 500,
            deployed: true,
            hp: 1
        });

        // Actions:
        // P1 fires:
        // 1. Weapon at P2 Hub 1 (500, 500) - distance 300px -> pull distance 162. (Hits in Round 1)
        // 2. Weapon at P2 Hub 2 (900, 500) - distance 700px -> pull distance 276. (Hits in Round 2)
        // P2 fires:
        // 1. Weapon at P1 Hub (200, 500) - distance 300px -> pull distance 162. (Hits in Round 1)
        //
        // In Round 1, P1's Hub and P2's Hub 1 are destroyed.
        // P1 has 0 hubs (is "dead").
        // In Round 2, P1's second weapon (already in flight) completes its path and destroys P2's Hub 2.
        // At the end of the turn, both are dead -> DRAW.
        const actions = {
            p1: [
                {
                    playerId: 'p1',
                    sourceId: p1Hub.id,
                    itemType: 'WEAPON',
                    angle: 0,
                    distance: 162
                },
                {
                    playerId: 'p1',
                    sourceId: p1Hub.id,
                    itemType: 'WEAPON',
                    angle: 0,
                    distance: 276
                }
            ],
            p2: [
                {
                    playerId: 'p2',
                    sourceId: p2Hub1.id,
                    itemType: 'WEAPON',
                    angle: 180,
                    distance: 162
                }
            ]
        };

        game.resolveTurn(actions);

        // Verify that P1's hub was destroyed
        const finalEntities = game.entities;
        const p1HubFinal = finalEntities.find((e) => e.id === p1Hub.id);
        expect(p1HubFinal).toBeUndefined();

        // Verify that both of P2's hubs were destroyed
        const p2Hub1Final = finalEntities.find((e) => e.id === p2Hub1.id);
        expect(p2Hub1Final).toBeUndefined();

        const p2Hub2Final = finalEntities.find((e) => e.id === p2Hub2.id);
        expect(p2Hub2Final).toBeUndefined();

        // Verify that both players are eliminated and the result is a DRAW
        expect(game.players['p1'].alive).toBe(false);
        expect(game.players['p2'].alive).toBe(false);
        expect(game.winner).toBe('DRAW');
    });
});
