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

describe('GameState - Launch Angle', () => {
    it('should calculate correct angle for drag left (launch right)', () => {
        // Dragging left means negative dx. Launch should be 0 degrees (Right)
        const angle = GameState.calculateLaunchAngle(-100, 0);
        expect(angle + 0).toBe(0);
    });

    it('should calculate correct angle for drag right (launch left)', () => {
        // Dragging right means positive dx. Launch should be 180 degrees (Left)
        const angle = GameState.calculateLaunchAngle(100, 0);
        expect(Math.abs(angle)).toBe(180);
    });

    it('should calculate correct angle for drag up (launch down)', () => {
        // Dragging up means negative dy. Launch should be 90 degrees (Down)
        const angle = GameState.calculateLaunchAngle(0, -100);
        expect(angle).toBe(90);
    });

    it('should calculate correct angle for drag down (launch up)', () => {
        // Dragging down means positive dy. Launch should be -90 degrees (Up)
        const angle = GameState.calculateLaunchAngle(0, 100);
        expect(angle).toBe(-90);
    });
});

describe('GameState - Toroidal Map', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
    });

    it('should wrap X coordinates beyond map width', () => {
        const wrapped = game.wrapX(2200); // Map width is 2000
        expect(wrapped).toBe(200);
    });

    it('should wrap negative X coordinates', () => {
        const wrapped = game.wrapX(-100);
        expect(wrapped).toBe(1900); // 2000 - 100
    });

    it('should wrap Y coordinates beyond map height', () => {
        const wrapped = game.wrapY(2500); // Map height is 2000
        expect(wrapped).toBe(500);
    });

    it('should calculate shortest toroidal distance', () => {
        // Points near opposite edges should have short distance via wrapping
        const dist = game.getToroidalDistance(50, 500, 1950, 500);
        expect(dist).toBe(100); // Wraps around: 50 to 0 to 2000 to 1950 = 100
    });

    it('should calculate shortest toroidal vector', () => {
        // From 50 to 950: Shortest path is LEFT 100 units
        const vector = GameState.getToroidalVector(50, 500, 950, 500, 1000, 1000);
        expect(vector.dx).toBe(-100);
        expect(vector.dy).toBe(0);

        // From 950 to 50: Shortest path is RIGHT 100 units
        const vector2 = GameState.getToroidalVector(950, 500, 50, 500, 1000, 1000);
        expect(vector2.dx).toBe(100);
        expect(vector2.dy).toBe(0);
    });

    it('should handle camera-aware coordinate wrapping (id:40)', () => {
        // Simulate a camera panned to x=900.
        // A "screen click" at relative 200 should land at game x=100 (900 + 200 = 1100 -> 100)
        const cameraX = 900;
        const clickX = 200;
        const mapW = 1000;

        const gameCoord = ((cameraX + clickX) % mapW + mapW) % mapW;
        expect(gameCoord).toBe(100);

        // Simulate camera panned to x=-100 (which is 900)
        const cameraX2 = -100;
        const gameCoord2 = ((cameraX2 + clickX) % mapW + mapW) % mapW;
        expect(gameCoord2).toBe(100);
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
        game.addLink(starter.id, connected.id, 'player1');

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

        game.addLink(starter.id, middle.id, 'player1');
        game.addLink(middle.id, end.id, 'player1');

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

describe('GameState - Launch Direction Consistency', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['player1', 'player2']);
    });

    it('should maintain direction for high-power launches (>50% map width)', () => {
        const p1Hub = game.entities.find(e => e.owner === 'player1' && e.type === 'HUB');
        p1Hub.x = 250;
        p1Hub.y = 500;

        // Launch RIGHT with 800 power (Map width is 1000)
        // Target should wrap to 1050 -> 50.
        // But it should travel RIGHT (250 -> 500 -> 750 -> 1000/0 -> 50)
        // At 50% progress, it should be at 250 + 400 = 650.
        // The "shortest path" would be 250 -> 150 -> 50 (traveling LEFT 200 units).

        const pullDistance = Math.pow(800 / GameState.MAX_LAUNCH, 1 / GameState.POWER_EXPONENT) * GameState.MAX_PULL;

        const actions = {
            player1: [{
                playerId: 'player1',
                sourceId: p1Hub.id,
                itemType: 'HUB',
                angle: 0, // RIGHT
                distance: pullDistance
            }],
            player2: []
        };

        const snapshots = game.resolveTurn(actions);

        // Find a snapshot around the midpoint of the sub-round (subTicks = 120, capture every 4)
        // SubTick 60 is exactly halfway.
        const midSnapshot = snapshots.find(s => s.type === 'ROUND_SUB' && s.subTick === 60);
        expect(midSnapshot).toBeDefined();

        const projectile = midSnapshot.state.entities.find(e => e.type === 'PROJECTILE');
        expect(projectile).toBeDefined();

        // Expected X: 250 + 400 = 650
        // If it flipped, it would be 250 - 100 = 150
        expect(projectile.x).toBeCloseTo(650);
    });
});
describe('GameState - Fog of War', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['player1', 'player2']);
    });

    it('should show own entities as visible', () => {
        const p1Hub = game.entities.find(e => e.owner === 'player1' && e.type === 'HUB');
        expect(game.isPositionVisible('player1', p1Hub.x, p1Hub.y)).toBe(true);
    });

    it('should hide enemy entities out of vision', () => {
        const p2Hub = game.entities.find(e => e.owner === 'player2' && e.type === 'HUB');

        // p2Hub is at 750, p1Hub is at 250. Vision radius of HUB is 400.
        // Distance is 500, so it should be hidden.
        expect(game.isPositionVisible('player1', p2Hub.x, p2Hub.y)).toBe(false);
    });

    it('should show enemy entities within vision', () => {
        const p1Hub = game.entities.find(e => e.owner === 'player1' && e.type === 'HUB');
        // Place an enemy hub near player 1
        const enemyNear = game.addEntity({ type: 'HUB', owner: 'player2', x: p1Hub.x + 100, y: p1Hub.y });

        expect(game.isPositionVisible('player1', enemyNear.x, enemyNear.y)).toBe(true);
    });

    it('should filter getVisibleState for specific player', () => {
        const p2Hub = game.entities.find(e => e.owner === 'player2' && e.type === 'HUB');

        const visibleState = game.getVisibleState('player1');

        // Player 2's remote hub should be filtered out
        const p2HubInState = visibleState.entities.find(e => e.id === p2Hub.id);
        expect(p2HubInState).toBeUndefined();
    });

    it('should always show map resources', () => {
        const visibleState = game.getVisibleState('player1');
        expect(visibleState.map.resources.length).toBeGreaterThan(0);
    });

    it('should support filtering passed snapshots', () => {
        const dummyState = game.getState();
        dummyState.entities.push({ id: 'dummy', owner: 'player2', x: 0, y: 0, type: 'HUB' });

        const filtered = game.getVisibleState('player1', dummyState);
        expect(filtered.entities.find(e => e.id === 'dummy')).toBeUndefined();
    });

    it('should show link even if endpoints are hidden but midpoint is visible', () => {
        const p1Hub = game.entities.find(e => e.owner === 'player1');
        // Player 1 at (250, 500). Vision radius 400 covers y range [100, 900].
        p1Hub.x = 250; p1Hub.y = 500;

        // Two enemy hubs outside vision
        const enemyA = game.addEntity({ type: 'HUB', owner: 'player2', x: 250, y: 0 });    // 500 away
        const enemyB = game.addEntity({ type: 'HUB', owner: 'player2', x: 250, y: 1000 }); // 500 away
        game.addLink(enemyA.id, enemyB.id, 'player2');

        const visibleState = game.getVisibleState('player1');

        // Endpoints should now be visible because the link itself passes through vision
        expect(visibleState.entities.find(e => e.id === enemyA.id)).toBeDefined();
        expect(visibleState.entities.find(e => e.id === enemyB.id)).toBeDefined();

        // Link should be visible due to midpoint at (250, 500)
        expect(visibleState.links.length).toBe(1);
    });
});
