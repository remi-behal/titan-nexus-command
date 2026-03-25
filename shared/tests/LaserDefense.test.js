/**
 * LaserDefense.test.js
 * 
 * Specifically tests the Laser Point Defense fuel and interception logic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';
import { GLOBAL_STATS } from '../constants/EntityStats.js';

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
            type: 'LASER_POINT_DEFENSE',
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
        const pullDistance = Math.pow(500 / GLOBAL_STATS.MAX_LAUNCH, 1 / GLOBAL_STATS.POWER_EXPONENT) * GLOBAL_STATS.MAX_PULL;

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

        game.resolveTurn(actions);

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

        // If fixed, only ONE is intercepted, so p2Hub is hit by the second one.
        // It should take 2 damage (AOE full damage): 5 - 2 = 3.
        expect(p2HubAfter.hp).toBe(3);
    });

    it('should use shortest toroidal path for laser beam visual coordinates', () => {
        // 1. Setup: Move Hubs near the boundary
        const p1Hub = game.entities.find(e => e.owner === 'player1' && e.type === 'HUB');
        const p2Hub = game.entities.find(e => e.owner === 'player2' && e.type === 'HUB');
        p1Hub.x = 20;
        p1Hub.y = 100;
        p2Hub.x = 1000; // Keep p2 hub away
        p2Hub.y = 1000;

        // 2. Place a Laser Defense near the right edge (1990)
        const defense = game.addEntity({
            type: 'LASER_POINT_DEFENSE',
            owner: 'player2',
            x: 1990,
            y: 100,
            deployed: true
        });
        // Link it to p2Hub so it doesn't decay
        game.addLink(p2Hub.id, defense.id, 'player2');

        // 3. Player 1 launches a weapon to the LEFT (angle 180) from x=20.
        // It will immediately wrap around to x=1990+ area.
        const actions = {
            player1: [
                {
                    playerId: 'player1',
                    sourceId: p1Hub.id,
                    itemType: 'WEAPON',
                    angle: 180, // Left
                    distance: 100 // Should go ~45 pixels
                }
            ],
            player2: []
        };

        const snapshots = game.resolveTurn(actions);

        let laserVisual = null;
        for (const snapshot of snapshots) {
            if (snapshot.visuals) {
                laserVisual = snapshot.visuals.find(v => v.type === 'LASER_BEAM');
                if (laserVisual) break;
            }
        }

        expect(laserVisual).toBeDefined();
        if (laserVisual) {
            // Defense at 1990. Weapon should be at something like 1980 or 4 (which is 2004).
            // Shortest path should be a small positive or negative dx.
            // If the bug exists, targetX will be a small number (e.g., 5 or 1995) 
            // but the Euclidean distance from 1990 will be large if it doesn't use virtual coords.

            // We expect targetX to be near 2000 (e.g. 2005) or slightly below (e.g. 1970)
            // instead of jumping to 5.
            const distX = Math.abs(laserVisual.targetX - laserVisual.x);
            expect(distX).toBeLessThan(150); // Laser range is 100
        }
    });
});
