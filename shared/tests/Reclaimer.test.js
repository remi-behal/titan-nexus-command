import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';
import { ENTITY_STATS } from '../constants/EntityStats.js';

describe('Reclaimer Tactical Weapon', () => {
    let gameState;
    const P1 = 'player-1';
    const P2 = 'player-2';

    beforeEach(() => {
        gameState = new GameState();
        gameState.initializeGame([P1, P2]);
    });

    it('should reclaim multiple friendly buildings and refund 50% cost', () => {
        const hub = gameState.entities.find((e) => e.owner === P1 && e.isStarter);
        // Place extractors far enough to NOT hit the starter hub (Starting x=250)
        // Distance 210 targets x=700 roughly.
        // Radius 75 hits everything between 625 and 775.
        const ext1 = gameState.addEntity({
            type: 'EXTRACTOR',
            owner: P1,
            x: 700,
            y: 500,
            deployed: true
        });
        const ext2 = gameState.addEntity({
            type: 'EXTRACTOR',
            owner: P1,
            x: 750,
            y: 500,
            deployed: true
        });
        gameState.addLink(hub.id, ext1.id, P1);
        gameState.addLink(ext1.id, ext2.id, P1);

        gameState.players[P1].energy = 50;

        const actions = {
            [P1]: [
                {
                    playerId: P1,
                    sourceId: hub.id,
                    itemType: 'RECLAIMER',
                    angle: 0,
                    distance: 210
                }
            ]
        };

        gameState.resolveTurn(actions);

        // 50 (start) + 10 (UBI) + 5 (ext1) + 5 (ext2) + 13+13 (Refunds) = 96
        expect(gameState.players[P1].energy).toBe(96);
        expect(gameState.entities.some((e) => e.id === ext1.id)).toBe(false);
        expect(gameState.entities.some((e) => e.id === ext2.id)).toBe(false);
    });

    it('should ignore enemy buildings', () => {
        const hubP1 = gameState.entities.find((e) => e.owner === P1 && e.isStarter);
        const hubP2 = gameState.entities.find((e) => e.owner === P2 && e.isStarter);
        // P2 structure within range of P1's reclaimer
        const extP2 = gameState.addEntity({
            type: 'EXTRACTOR',
            owner: P2,
            x: 700,
            y: 500,
            deployed: true
        });
        gameState.addLink(hubP2.id, extP2.id, P2);

        gameState.players[P1].energy = 50;

        const actions = {
            [P1]: [
                {
                    playerId: P1,
                    sourceId: hubP1.id,
                    itemType: 'RECLAIMER',
                    angle: 0,
                    distance: 210
                }
            ]
        };

        gameState.resolveTurn(actions);

        expect(gameState.entities.some((e) => e.id === extP2.id)).toBe(true);
        expect(gameState.players[P1].energy).toBe(60); // Only UBI
    });

    it('should allow self-reclaim of the source hub if launched at zero distance', () => {
        const hub = gameState.entities.find((e) => e.owner === P1 && e.isStarter);
        gameState.players[P1].energy = 50;

        const actions = {
            [P1]: [
                {
                    playerId: P1,
                    sourceId: hub.id,
                    itemType: 'RECLAIMER',
                    angle: 0,
                    distance: 0
                }
            ]
        };

        gameState.resolveTurn(actions);

        expect(gameState.entities.some((e) => e.id === hub.id)).toBe(false);
        expect(gameState.players[P1].alive).toBe(false);
        expect(gameState.players[P1].energy).toBe(70); // 50 + 10 + 10 refund
    });

    it('should trigger Link Decay for orphaned buildings', () => {
        const hub = gameState.entities.find((e) => e.owner === P1 && e.isStarter);
        const bridge = gameState.addEntity({
            type: 'HUB',
            owner: P1,
            x: 700,
            y: 500,
            deployed: true
        });
        const ext = gameState.addEntity({
            type: 'EXTRACTOR',
            owner: P1,
            x: 750,
            y: 500,
            deployed: true
        });

        gameState.addLink(hub.id, bridge.id, P1);
        gameState.addLink(bridge.id, ext.id, P1);

        gameState.players[P1].energy = 50;

        const actions = {
            [P1]: [
                {
                    playerId: P1,
                    sourceId: hub.id,
                    itemType: 'RECLAIMER',
                    angle: 0,
                    distance: 210
                }
            ]
        };

        gameState.resolveTurn(actions);

        expect(gameState.entities.some((e) => e.id === bridge.id)).toBe(false);
        expect(gameState.entities.some((e) => e.id === ext.id)).toBe(false);
    });

    it('should be non-interceptable by point defense systems', () => {
        const hubP1 = gameState.entities.find((e) => e.owner === P1 && e.isStarter);
        const hubP2 = gameState.entities.find((e) => e.owner === P2 && e.isStarter);

        // Add Laser Point Defense for P2 (between P1 hub and P1 extractor)
        const laserP2 = gameState.addEntity({
            type: 'LASER_POINT_DEFENSE',
            owner: P2,
            x: 500,
            y: 500,
            deployed: true
        });
        gameState.addLink(hubP2.id, laserP2.id, P2); // Keep it fueled/active

        const targetExt = gameState.addEntity({
            type: 'EXTRACTOR',
            owner: P1,
            x: 700,
            y: 500,
            deployed: true
        });
        gameState.addLink(hubP1.id, targetExt.id, P1);

        const actions = {
            [P1]: [
                {
                    playerId: P1,
                    sourceId: hubP1.id,
                    itemType: 'RECLAIMER',
                    angle: 0,
                    distance: 210 // Path crosses over/near the laser at 500
                }
            ]
        };

        gameState.resolveTurn(actions);

        // Reclaimer should NOT be intercepted and should reach target
        expect(gameState.entities.some((e) => e.id === targetExt.id)).toBe(false);
        // Laser should still have its fuel (since it skipped the non-interceptable reclaimer)
        const laserAfter = gameState.entities.find((e) => e.id === laserP2.id);
        expect(laserAfter.fuel).toBe(ENTITY_STATS.LASER_POINT_DEFENSE.fuel);
    });
});
