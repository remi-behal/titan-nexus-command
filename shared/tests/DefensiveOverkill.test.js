import { describe, it, expect } from 'vitest';
import { GameState } from '../GameState.js';
import { ENTITY_STATS } from '../constants/EntityStats.js';

describe('GameState - Defensive Overkill', () => {
    it('should NOT allow standard SAM missiles to reacquire a new target if their original target is destroyed (defensive overkill)', () => {
        const game = new GameState();
        game.initializeGame(['p1', 'p2']);

        game.entities = [];
        // Player 1 Hub
        const h1 = game.addEntity({
            type: 'HUB',
            x: 100,
            y: 100,
            owner: 'p1',
            deployed: true,
            isStarter: true
        });
        // Player 2 Hub
        const h2 = game.addEntity({
            type: 'HUB',
            x: 1900,
            y: 100,
            owner: 'p2',
            deployed: true,
            isStarter: true
        });

        // Player 1 Standard SAM at (1500, 100).
        // Range is 200px (covers [1300, 1700]).
        const sam = game.addEntity({
            type: 'LIGHT_SAM_DEFENSE',
            x: 1500,
            y: 100,
            owner: 'p1',
            deployed: true,
            fuel: 10
        });
        game.addLink(h1.id, sam.id, 'p1');

        // Player 1 Flak defense at (1300, 100) to destroy the first target early.
        // Range is 150px (covers [1150, 1450]).
        const flak = game.addEntity({
            type: 'FLAK_DEFENSE',
            x: 1300,
            y: 100,
            owner: 'p1',
            deployed: true,
            fuel: 10
        });
        game.addLink(h1.id, flak.id, 'p1');

        game.players.p1.energy = 1000;
        game.players.p2.energy = 1000;

        // Player 2 fires TWO weapons.
        // Weapon 1: lands at 1100 (distance 800), passes through flak range [1150, 1450]. ID: proj-p2-0
        // Weapon 2: lands at 1500 (distance 400). ID: proj-p2-1
        const snapshots = game.resolveTurn({
            p2: [
                { playerId: 'p2', sourceId: h2.id, itemType: 'WEAPON', angle: 180, distance: 800 },
                { playerId: 'p2', sourceId: h2.id, itemType: 'WEAPON', angle: 180, distance: 400 }
            ]
        });

        // Verification logic:
        // Check all snapshots to see if the standard SAM missile ever locked onto the second weapon (proj-p2-1).
        let samReacquiredWeapon2 = false;
        snapshots.forEach((s) => {
            if (s.state && s.state.entities) {
                s.state.entities.forEach((e) => {
                    if (e.itemType === 'SAM_MISSILE' && e.targetId === 'proj-p2-1') {
                        samReacquiredWeapon2 = true;
                    }
                });
            }
        });

        // Standard SAM must not reacquire!
        expect(samReacquiredWeapon2).toBe(false);

        // Verification of firing:
        // Verify that a SAM missile was indeed launched in response to the first weapon
        let samFired = false;
        snapshots.forEach((s) => {
            if (s.state && s.state.entities) {
                if (s.state.entities.some((e) => e.itemType === 'SAM_MISSILE')) {
                    samFired = true;
                }
            }
        });
        expect(samFired).toBe(true);
    });

    it('should verify standard SAM has reacquire: false and Smart SAM has reacquire: true', () => {
        expect(ENTITY_STATS.SAM_MISSILE.reacquire).toBeUndefined();
        expect(ENTITY_STATS.SMART_SAM_MISSILE.reacquire).toBe(true);
    });
});
