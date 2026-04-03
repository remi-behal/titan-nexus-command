import { describe, it, expect } from 'vitest';
import GameState from '../GameState';
import { ENTITY_STATS, GLOBAL_STATS } from '../constants/EntityStats';

describe('Smart SAM Defense Logic', () => {
    it('should reacquire a new target WITHIN a single turn if the original one is destroyed', () => {
        const game = new GameState();
        game.initializeGame(['p1', 'p2']);

        game.entities = [];
        // Player 1 Hub
        const h1 = game.addEntity({ type: 'HUB', x: 100, y: 100, owner: 'p1', deployed: true, isStarter: true });
        // Player 2 Hub
        const h2 = game.addEntity({ type: 'HUB', x: 1900, y: 100, owner: 'p2', deployed: true, isStarter: true });

        // Player 1 Smart SAM at (300, 100)
        const sam = game.addEntity({
            type: 'SMART_SAM_DEFENSE',
            x: 300,
            y: 100,
            owner: 'p1',
            deployed: true,
            fuel: 10
        });
        game.links.push({ from: h1.id, to: sam.id });

        // Player 1 also has a FLAK defense at (1400, 100) to destroy the first target early
        const flak = game.addEntity({
            type: 'FLAK_DEFENSE',
            x: 1400,
            y: 100,
            owner: 'p1',
            deployed: true,
            fuel: 10
        });
        game.links.push({ from: h1.id, to: flak.id });

        game.players.p1.energy = 1000;
        game.players.p2.energy = 1000;

        // Turn 1: Player 2 fires TWO weapons
        // Weapon 1: Reaches Flak range at approx tick 100 (1900 - 1400 = 500. 500 / 5 = 100)
        // Weapon 2: Further behind
        const snapshots = game.resolveTurn({
            p2: [
                { playerId: 'p2', sourceId: h2.id, itemType: 'WEAPON', angle: 180, distance: 800 },
                { playerId: 'p2', sourceId: h2.id, itemType: 'WEAPON', angle: 180, distance: 400 }
            ]
        });

        // Verification logic:
        // 1. Check if SAM missile fired
        const samFired = snapshots.some(s => s.state.entities.some(e => e.itemType === 'SMART_SAM_MISSILE'));
        expect(samFired).toBe(true);

        // 2. Both targets should be gone
        const weaponsLeft = game.entities.filter(e => e.type === 'WEAPON');
        expect(weaponsLeft.length).toBe(0);

        // 3. Verify no persistence
        const persistentMissile = game.entities.find(e => e.type === 'SMART_SAM_MISSILE');
        expect(persistentMissile).toBeUndefined();
    });
});
