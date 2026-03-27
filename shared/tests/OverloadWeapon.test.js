import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';
import { ENTITY_STATS } from '../constants/EntityStats.js';

describe('Overload Weapon', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['player1', 'player2']);
        game.map.lakes = [];
        game.map.mountains = [];
    });

    it('should damage Hub and its immediate children when Hub is hit directly', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'player1' && e.isStarter);
        const child1 = game.addEntity({
            type: 'HUB',
            owner: 'player1',
            x: p1Hub.x + 100,
            y: p1Hub.y
        });
        const grandchild = game.addEntity({
            type: 'HUB',
            owner: 'player1',
            x: child1.x + 100,
            y: child1.y
        });

        game.addLink(p1Hub.id, child1.id, 'player1');
        game.addLink(child1.id, grandchild.id, 'player1');

        // Initial HP
        expect(p1Hub.hp).toBe(ENTITY_STATS.HUB.hp);
        expect(child1.hp).toBe(ENTITY_STATS.HUB.hp);
        expect(grandchild.hp).toBe(ENTITY_STATS.HUB.hp);

        // Hit p1Hub with Overload
        const stats = ENTITY_STATS.OVERLOAD;
        const impacts = new Set();
        const tempVisuals = [];
        const overloadedThisRound = new Set();

        game.triggerOverload(p1Hub.x, p1Hub.y, stats, tempVisuals, impacts, overloadedThisRound);

        expect(p1Hub.hp).toBe(ENTITY_STATS.HUB.hp - 1);
        expect(child1.hp).toBe(ENTITY_STATS.HUB.hp - 1);
        expect(grandchild.hp).toBe(ENTITY_STATS.HUB.hp); // 1-hop only
    });

    it('should damage only the downstream structure when a link is hit', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'player1' && e.isStarter);
        const child1 = game.addEntity({
            type: 'HUB',
            owner: 'player1',
            x: p1Hub.x + 100,
            y: p1Hub.y
        });
        game.addLink(p1Hub.id, child1.id, 'player1');

        // Hit the midpoint of the link
        const midX = (p1Hub.x + child1.x) / 2;
        const midY = (p1Hub.y + child1.y) / 2;

        const stats = ENTITY_STATS.OVERLOAD;
        game.triggerOverload(midX, midY, stats, [], new Set(), new Set());

        expect(p1Hub.hp).toBe(ENTITY_STATS.HUB.hp); // Parent unaffected
        expect(child1.hp).toBe(ENTITY_STATS.HUB.hp - 1); // Downstream affected
    });

    it('should limit damage to 1 HP per round even if multiple parts are hit', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'player1' && e.isStarter);
        const child1 = game.addEntity({
            type: 'HUB',
            owner: 'player1',
            x: p1Hub.x + 100,
            y: p1Hub.y
        });
        game.addLink(p1Hub.id, child1.id, 'player1');

        const stats = ENTITY_STATS.OVERLOAD;
        const overloadedThisRound = new Set();

        // Explosion covers both Hub and Link
        // We'll call it twice manually to simulate two hits in one round
        game.triggerOverload(p1Hub.x, p1Hub.y, stats, [], new Set(), overloadedThisRound);
        game.triggerOverload(p1Hub.x + 50, p1Hub.y, stats, [], new Set(), overloadedThisRound);

        expect(p1Hub.hp).toBe(ENTITY_STATS.HUB.hp - 1);
        expect(child1.hp).toBe(ENTITY_STATS.HUB.hp - 1);
    });

    it('should correctly propagate multi-downstream hits', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'player1' && e.isStarter);
        const child1 = game.addEntity({
            type: 'HUB',
            owner: 'player1',
            x: p1Hub.x + 100,
            y: p1Hub.y - 50
        });
        const child2 = game.addEntity({
            type: 'HUB',
            owner: 'player1',
            x: p1Hub.x + 100,
            y: p1Hub.y + 50
        });

        game.addLink(p1Hub.id, child1.id, 'player1');
        game.addLink(p1Hub.id, child2.id, 'player1');

        game.triggerOverload(p1Hub.x, p1Hub.y, ENTITY_STATS.OVERLOAD, [], new Set(), new Set());

        expect(p1Hub.hp).toBe(ENTITY_STATS.HUB.hp - 1);
        expect(child1.hp).toBe(ENTITY_STATS.HUB.hp - 1);
        expect(child2.hp).toBe(ENTITY_STATS.HUB.hp - 1);
    });

    it('should not land as a structure or create a link upon resolution, but still damage targets', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'player1' && e.isStarter);
        const p2Hub = game.entities.find((e) => e.owner === 'player2' && e.isStarter);

        // Setup: launcher at (0, 100), target at (138, 100)
        // With pull distance 100, launch distance is ~137.9
        p1Hub.x = 0;
        p1Hub.y = 100;
        p2Hub.x = 138;
        p2Hub.y = 100;

        // Stage an OVERLOAD launch
        const actions = {
            player1: [
                {
                    playerId: 'player1',
                    type: 'LAUNCH',
                    itemType: 'OVERLOAD',
                    sourceId: p1Hub.id,
                    angle: 0,
                    distance: 100
                }
            ]
        };

        // Before resolution
        const initialEntityCount = game.entities.length;
        const initialLinkCount = game.links.length;

        // Resolve turn
        game.resolveTurn(actions);

        // After resolution:
        // 1. Target hub should be damaged (proving triggerOverload was called)
        expect(p2Hub.hp).toBe(ENTITY_STATS.HUB.hp - 1);

        // 2. There should NOT be a new entity of type OVERLOAD
        const overloadEntities = game.entities.filter((e) => e.type === 'OVERLOAD');
        expect(overloadEntities.length).toBe(0);

        // 3. There should NOT be a new link
        expect(game.links.length).toBe(initialLinkCount);

        // 4. Hubs count should stay the same (only original ones)
        const hubs = game.entities.filter((e) => e.type === 'HUB');
        expect(hubs.length).toBe(initialEntityCount);
    });
});
