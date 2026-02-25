/**
 * LaserDefense.test.js
 * 
 * Specifically tests the Laser Point Defense fuel and interception logic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from './GameState.js';

describe('GameState - Laser Defense Fuel', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['player1', 'player2']);
    });

    it('should only intercept once per turn, even across multiple rounds', () => {
        const p1Hub = game.entities.find(e => e.owner === 'player1' && e.type === 'HUB');
        const p2Hub = game.entities.find(e => e.owner === 'player2' && e.type === 'HUB');

        // 1. Add a Laser Defense for Player 2 near their hub
        const defense = game.addEntity({
            type: 'DEFENSE',
            owner: 'player2',
            x: p2Hub.x - 50,
            y: p2Hub.y,
            deployed: true
        });
        game.addLink(p2Hub.id, defense.id, 'player2');

        // 2. Player 1 launches TWO weapons in TWO separate rounds
        // To ensure they are in separate rounds, we can't easily force it with playerActionsMap 
        // unless we understand how resolveTurn handles rounds.
        // Looking at Gamestate.js: resolveTurn takes playerActionsMap[pid] = [action1, action2]
        // Round 1 takes action1 from each player. Round 2 takes action2.

        const dx = defense.x - p1Hub.x;
        const dy = defense.y - p1Hub.y;
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const pullDistance = Math.pow(500 / GameState.MAX_LAUNCH, 1 / GameState.POWER_EXPONENT) * GameState.MAX_PULL;

        const actions = {
            player1: [
                {
                    playerId: 'player1',
                    sourceId: p1Hub.id,
                    itemType: 'WEAPON',
                    angle: angle,
                    distance: pullDistance
                },
                {
                    playerId: 'player1',
                    sourceId: p1Hub.id,
                    itemType: 'WEAPON',
                    angle: angle,
                    distance: pullDistance
                }
            ],
            player2: []
        };

        // Before resolution, defense has 1 fuel
        expect(defense.fuel).toBe(1);

        const snapshots = game.resolveTurn(actions);

        // We expect:
        // Round 1: Weapon 1 is intercepted. Defense fuel 1 -> 0.
        // Round 2: Weapon 2 is NOT intercepted (because fuel is 0). It hits something or just lands.

        // Let's check the console logs or snapshots to verify destruction.
        // Or just check if the second weapon survived.

        // Actually, let's look at how many DESTROYED messages we would get.
        // Better: check the state after turn resolution.
        // But wait, weapons are destroyed at the end of their round anyway.

        // Let's check if the p2Hub was hit by the second weapon.
        // If the second weapon was NOT intercepted, it should hit p2Hub (since it's aimed at the defense near it).
        // The hub has 100 HP. A weapon hit deals 100 damage (line 529).

        const p2HubAfter = game.entities.find(e => e.id === p2Hub.id);

        // If the bug exists, BOTH weapons are intercepted, so p2Hub survives.
        // If fixed, only ONE is intercepted, so p2Hub is destroyed by the second one.

        // Wait, line 604 refuels it AFTER Round 1.
        // So in the current code (with bug), it WILL survive.

        expect(p2HubAfter).toBeUndefined(); // It should be destroyed if fixed
    });
});
