import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';
import { ENTITY_STATS, GLOBAL_STATS } from '../constants/EntityStats.js';

describe('Shield Defense Logic', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['player1', 'player2']);
        game.map.lakes = [];
        game.map.mountains = [];
    });

    it('should block an enemy weapon entering from outside and reduce barrier HP', () => {
        const shield = game.addEntity({
            type: 'SHIELD',
            owner: 'player1',
            x: 500,
            y: 500,
            deployed: true,
            isStarter: true
        });

        const actions = {
            player1: [],
            player2: [{
                playerId: 'player2',
                itemType: 'WEAPON',
                sourceId: game.entities.find(e => e.owner === 'player2' && e.type === 'HUB').id,
                angle: 180,
                distance: 500
            }]
        };

        const snapshots = game.resolveTurn(actions);

        let blocked = false;
        snapshots.forEach(s => {
            if (s.type === 'ROUND_SUB') {
                const proj = s.state.entities.find(e => e.itemType === 'WEAPON' && e.owner === 'player2');
                const spark = s.state.entities.find(e => e.type === 'SPARK');
                // The projectile might exist in one sub-tick and then be gone from the list in the next if it's inactive
                if (spark) blocked = true;
                if (proj && !proj.active) blocked = true;
            }
        });

        expect(blocked).toBe(true);
        // WEAPON damage is 2.
        expect(shield.barrierHp).toBe(ENTITY_STATS.SHIELD.barrierHpMax - 2);
    });

    it('should block friendly fire entering from outside (Total Blockade)', () => {
        const shield = game.addEntity({
            type: 'SHIELD',
            owner: 'player1',
            x: 500,
            y: 500,
            deployed: true,
            isStarter: true
        });

        const actions = {
            player1: [{
                playerId: 'player1',
                itemType: 'WEAPON',
                sourceId: game.entities.find(e => e.owner === 'player1' && e.type === 'HUB').id,
                angle: 0,
                distance: 250
            }],
            player2: []
        };

        game.resolveTurn(actions);
        expect(shield.barrierHp).toBe(ENTITY_STATS.SHIELD.barrierHpMax - 2);
    });

    it('should block structure launches (HUB) but take NO damage to barrier', () => {
        const shield = game.addEntity({
            type: 'SHIELD',
            owner: 'player1',
            x: 500,
            y: 500,
            deployed: true,
            isStarter: true
        });

        const hubsBefore = game.entities.filter(e => e.owner === 'player2' && e.type === 'HUB').length;

        const actions = {
            player1: [],
            player2: [{
                playerId: 'player2',
                itemType: 'HUB',
                sourceId: game.entities.find(e => e.owner === 'player2' && e.type === 'HUB').id,
                angle: 180,
                distance: 500
            }]
        };

        game.resolveTurn(actions);

        expect(shield.barrierHp).toBe(ENTITY_STATS.SHIELD.barrierHpMax);
        const hubsAfter = game.entities.filter(e => e.owner === 'player2' && e.type === 'HUB').length;
        expect(hubsAfter).toBe(hubsBefore);
    });

    it('should allow outgoing fire from inside the barrier (Crossing Rule)', () => {
        const p1Hub = game.entities.find(e => e.owner === 'player1' && e.type === 'HUB');
        const shield = game.addEntity({
            type: 'SHIELD',
            owner: 'player1',
            x: p1Hub.x,
            y: p1Hub.y,
            deployed: true,
            isStarter: true
        });

        const actions = {
            player1: [{
                playerId: 'player1',
                itemType: 'WEAPON',
                sourceId: p1Hub.id,
                angle: 0,
                distance: 200
            }],
            player2: []
        };

        const snapshots = game.resolveTurn(actions);

        let explosionFound = false;
        snapshots.forEach(s => {
            if (s.type === 'ROUND_SUB') {
                if (s.state.entities.some(e => e.type === 'EXPLOSION')) explosionFound = true;
            }
        });

        expect(explosionFound).toBe(true);
        expect(shield.barrierHp).toBe(ENTITY_STATS.SHIELD.barrierHpMax);
    });

    it('should allow Reclaimer to pass through shields', () => {
        const shield = game.addEntity({
            type: 'SHIELD',
            owner: 'player1',
            x: 500,
            y: 500,
            deployed: true,
            isStarter: true
        });

        const actions = {
            player1: [{
                playerId: 'player1',
                itemType: 'RECLAIMER',
                sourceId: game.entities.find(e => e.owner === 'player1' && e.type === 'HUB').id,
                angle: 0,
                distance: 500
            }],
            player2: []
        };

        const snapshots = game.resolveTurn(actions);

        let reclaimerActiveAcrossBoundary = false;
        snapshots.forEach(s => {
            if (s.type === 'ROUND_SUB' && s.subTick > 50) { // Should have crossed boundary
                const proj = s.state.entities.find(e => e.itemType === 'RECLAIMER');
                if (proj && proj.x > 500) reclaimerActiveAcrossBoundary = true;
            }
        });

        expect(reclaimerActiveAcrossBoundary).toBe(true);
        expect(shield.barrierHp).toBe(ENTITY_STATS.SHIELD.barrierHpMax);
    });

    it('should recharge barrier HP at the turn start', () => {
        const shield = game.addEntity({
            type: 'SHIELD',
            owner: 'player1',
            x: 100,
            y: 100,
            deployed: true,
            isStarter: true
        });

        // Set to HP-1 to ensure room for recharge
        shield.barrierHp = ENTITY_STATS.SHIELD.barrierHpMax - 1;

        game.resolveTurn({ player1: [], player2: [] });
        expect(shield.barrierHp).toBe(ENTITY_STATS.SHIELD.barrierHpMax);
    });

    it('should handle toroidal crossing correctly (Manual Logic Check)', () => {
        const shield = game.addEntity({
            type: 'SHIELD',
            owner: 'player1',
            x: 1990,
            y: 500,
            deployed: true
        });

        const prevX = 150;
        const currX = 0;

        const prevDist = game.getToroidalDistance(shield.x, shield.y, prevX, 500);
        const currDist = game.getToroidalDistance(shield.x, shield.y, currX, 500);

        expect(prevDist).toBe(160);
        expect(currDist).toBe(10);

        const range = 125;
        const isBlocked = (prevDist > range && currDist <= range);
        expect(isBlocked).toBe(true);
    });
});
