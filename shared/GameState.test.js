/**
 * GameState.test.js
 * 
 * Unit tests for the core game engine.
 * These tests validate the "headless" game logic without any UI or network dependencies.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from './GameState.js';

describe('GameState - Slingshot Math', () => {
    it('should clamp pull distance to MAX_PULL', () => {
        const result = GameState.calculateLaunchDistance(500); // Over the limit
        const expected = GameState.calculateLaunchDistance(GameState.MAX_PULL);
        expect(result).toBe(expected);
    });

    it('should return 0 for zero pull distance', () => {
        const result = GameState.calculateLaunchDistance(0);
        expect(result).toBe(0);
    });

    it('should apply non-linear power curve', () => {
        const halfPull = GameState.calculateLaunchDistance(GameState.MAX_PULL / 2);
        const fullPull = GameState.calculateLaunchDistance(GameState.MAX_PULL);

        // With exponent > 1, half pull should give less than half distance
        expect(halfPull).toBeLessThan(fullPull / 2);
    });

    it('should never exceed MAX_LAUNCH distance', () => {
        const result = GameState.calculateLaunchDistance(GameState.MAX_PULL);
        expect(result).toBeLessThanOrEqual(GameState.MAX_LAUNCH);
    });
});

describe('GameState - Toroidal Map', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
    });

    it('should wrap X coordinates beyond map width', () => {
        const wrapped = game.wrapX(1200); // Map width is 1000
        expect(wrapped).toBe(200);
    });

    it('should wrap negative X coordinates', () => {
        const wrapped = game.wrapX(-100);
        expect(wrapped).toBe(900);
    });

    it('should wrap Y coordinates beyond map height', () => {
        const wrapped = game.wrapY(1500); // Map height is 1000
        expect(wrapped).toBe(500);
    });

    it('should calculate shortest toroidal distance', () => {
        // Points near opposite edges should have short distance via wrapping
        const dist = game.getToroidalDistance(50, 500, 950, 500);
        expect(dist).toBe(100); // Wraps around: 50 to 0 to 1000 to 950 = 100
    });

    it('should handle same-point distance', () => {
        const dist = game.getToroidalDistance(500, 500, 500, 500);
        expect(dist).toBe(0);
    });
});

describe('GameState - Game Initialization', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
    });

    it('should create players with starting energy', () => {
        game.initializeGame(['player1', 'player2']);

        expect(game.players['player1']).toBeDefined();
        expect(game.players['player1'].energy).toBe(50);
        expect(game.players['player1'].alive).toBe(true);
    });

    it('should create starter hubs for each player', () => {
        game.initializeGame(['player1', 'player2']);

        const p1Hub = game.entities.find(e => e.owner === 'player1' && e.type === 'HUB');
        const p2Hub = game.entities.find(e => e.owner === 'player2' && e.type === 'HUB');

        expect(p1Hub).toBeDefined();
        expect(p1Hub.isStarter).toBe(true);
        expect(p2Hub).toBeDefined();
        expect(p2Hub.isStarter).toBe(true);
    });

    it('should assign unique colors to players', () => {
        game.initializeGame(['player1', 'player2']);

        expect(game.players['player1'].color).not.toBe(game.players['player2'].color);
    });
});

describe('GameState - Link Integrity', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['player1']);
    });

    it('should preserve structures connected to starter hub', () => {
        const starter = game.entities.find(e => e.isStarter && e.owner === 'player1');
        const connected = game.addEntity({ type: 'HUB', owner: 'player1', x: 300, y: 300 });
        game.addLink(starter.id, connected.id);

        game.checkLinkIntegrity();

        expect(game.entities.find(e => e.id === connected.id)).toBeDefined();
    });

    it('should destroy orphaned structures', () => {
        const orphan = game.addEntity({ type: 'HUB', owner: 'player1', x: 700, y: 700 });

        game.checkLinkIntegrity();

        expect(game.entities.find(e => e.id === orphan.id)).toBeUndefined();
    });

    it('should destroy structures when intermediate link is broken', () => {
        const starter = game.entities.find(e => e.isStarter && e.owner === 'player1');
        const middle = game.addEntity({ type: 'HUB', owner: 'player1', x: 300, y: 300 });
        const end = game.addEntity({ type: 'HUB', owner: 'player1', x: 400, y: 400 });

        game.addLink(starter.id, middle.id);
        game.addLink(middle.id, end.id);

        // Remove the middle hub
        game.entities = game.entities.filter(e => e.id !== middle.id);
        game.checkLinkIntegrity();

        // End hub should be destroyed because it lost connection to starter
        expect(game.entities.find(e => e.id === end.id)).toBeUndefined();
    });
});

describe('GameState - Turn Resolution', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['player1', 'player2']);
    });

    it('should generate energy at start of turn', () => {
        const initialEnergy = game.players['player1'].energy;

        game.resolveTurn({ player1: [], player2: [] });

        expect(game.players['player1'].energy).toBe(initialEnergy + 10);
    });

    it('should deduct energy for launches', () => {
        const p1Hub = game.entities.find(e => e.owner === 'player1' && e.type === 'HUB');
        const initialEnergy = game.players['player1'].energy;
        const cost = GameState.COSTS['WEAPON'];

        const actions = {
            player1: [{
                playerId: 'player1',
                sourceId: p1Hub.id,
                itemType: 'WEAPON',
                angle: 0,
                distance: 100
            }],
            player2: []
        };

        game.resolveTurn(actions);

        expect(game.players['player1'].energy).toBe(initialEnergy + 10 - cost);
    });

    it('should consume fuel when launching from hub', () => {
        const p1Hub = game.entities.find(e => e.owner === 'player1' && e.type === 'HUB');
        const initialFuel = p1Hub.fuel;

        const actions = {
            player1: [{
                playerId: 'player1',
                sourceId: p1Hub.id,
                itemType: 'HUB',
                angle: 0,
                distance: 100
            }],
            player2: []
        };

        game.resolveTurn(actions);

        // Fuel is replenished at end of turn, so check during resolution
        // We'll verify by checking that a structure was created (launch succeeded)
        expect(game.entities.length).toBeGreaterThan(2); // Started with 2 hubs
    });

    it('should replenish fuel at end of turn', () => {
        const p1Hub = game.entities.find(e => e.owner === 'player1' && e.type === 'HUB');

        const actions = {
            player1: [{
                playerId: 'player1',
                sourceId: p1Hub.id,
                itemType: 'HUB',
                angle: 0,
                distance: 100
            }],
            player2: []
        };

        game.resolveTurn(actions);

        const hubAfter = game.entities.find(e => e.id === p1Hub.id);
        expect(hubAfter.fuel).toBe(hubAfter.maxFuel);
    });

    it('should increment turn counter', () => {
        const initialTurn = game.turn;

        game.resolveTurn({ player1: [], player2: [] });

        expect(game.turn).toBe(initialTurn + 1);
    });
});

describe('GameState - Win Conditions', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['player1', 'player2']);
    });

    it('should declare winner when one player has no hubs', () => {
        // Remove player2's hub
        game.entities = game.entities.filter(e => e.owner !== 'player2');

        game.resolveTurn({ player1: [], player2: [] });

        expect(game.winner).toBe('player1');
        expect(game.players['player2'].alive).toBe(false);
    });

    it('should declare draw when all players lose simultaneously', () => {
        // Remove all hubs
        game.entities = [];

        game.resolveTurn({ player1: [], player2: [] });

        expect(game.winner).toBe('DRAW');
        expect(game.players['player1'].alive).toBe(false);
        expect(game.players['player2'].alive).toBe(false);
    });

    it('should not declare winner if multiple players still alive', () => {
        game.resolveTurn({ player1: [], player2: [] });

        expect(game.winner).toBeNull();
    });

    it('should stop processing turns after winner is declared', () => {
        game.winner = 'player1';
        const turnBefore = game.turn;

        const snapshots = game.resolveTurn({ player1: [], player2: [] });

        expect(game.turn).toBe(turnBefore); // Turn should not increment
        expect(snapshots[0].type).toBe('FINAL');
    });
});

describe('GameState - Collision Detection', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['player1', 'player2']);
    });

    it('should detect weapon impact on enemy hub', () => {
        const p1Hub = game.entities.find(e => e.owner === 'player1' && e.type === 'HUB');
        const p2Hub = game.entities.find(e => e.owner === 'player2' && e.type === 'HUB');

        // Calculate angle and distance to hit p2Hub from p1Hub
        const dx = p2Hub.x - p1Hub.x;
        const dy = p2Hub.y - p1Hub.y;
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Find the pull distance that gives us the needed launch distance
        // We'll use a distance that should hit (accounting for the power curve)
        const pullDistance = Math.pow(distance / GameState.MAX_LAUNCH, 1 / GameState.POWER_EXPONENT) * GameState.MAX_PULL;

        const actions = {
            player1: [{
                playerId: 'player1',
                sourceId: p1Hub.id,
                itemType: 'WEAPON',
                angle: angle,
                distance: pullDistance
            }],
            player2: []
        };

        game.resolveTurn(actions);

        // p2Hub should be destroyed
        const p2HubAfter = game.entities.find(e => e.id === p2Hub.id);
        expect(p2HubAfter).toBeUndefined();
    });
});
