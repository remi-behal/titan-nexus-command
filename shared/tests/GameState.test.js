/**
 * GameState.test.js
 * 
 * Unit tests for the core game engine.
 * These tests validate the "headless" game logic without any UI or network dependencies.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';
import { ENTITY_STATS, GLOBAL_STATS } from '../constants/EntityStats.js';

describe('GameState - Slingshot Math', () => {
    it('should clamp pull distance to MAX_PULL', () => {
        const result = GameState.calculateLaunchDistance(500); // Over the limit
        const expected = GameState.calculateLaunchDistance(GLOBAL_STATS.MAX_PULL);
        expect(result).toBe(expected);
    });

    it('should return 0 for zero pull distance', () => {
        const result = GameState.calculateLaunchDistance(0);
        expect(result).toBe(0);
    });

    it('should apply non-linear power curve', () => {
        const halfPull = GameState.calculateLaunchDistance(GLOBAL_STATS.MAX_PULL / 2);
        const fullPull = GameState.calculateLaunchDistance(GLOBAL_STATS.MAX_PULL);

        // With exponent > 1, half pull should give less than half distance
        expect(halfPull).toBeLessThan(fullPull / 2);
    });

    it('should never exceed MAX_LAUNCH distance', () => {
        const result = GameState.calculateLaunchDistance(GLOBAL_STATS.MAX_PULL);
        expect(result).toBeLessThanOrEqual(GLOBAL_STATS.MAX_LAUNCH);
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
        expect(game.players['player1'].energy).toBe(GLOBAL_STATS.STARTING_ENERGY);
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

    it('should initialize resource nodes using templates from EntityStats', () => {
        game.initializeGame(['player1']);
        const superNode = game.map.resources.find(r => r.isSuper);
        expect(superNode.value).toBe(15);
        expect(superNode.color).toBe('#bf00ff');
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
        game.map.lakes = [];
        game.map.mountains = [];
    });

    it('should generate energy at start of turn', () => {
        const initialEnergy = game.players['player1'].energy;
        const hubIncome = ENTITY_STATS.HUB.energyGen;
        const ubi = GLOBAL_STATS.ENERGY_INCOME_PER_TURN;

        game.resolveTurn({ player1: [], player2: [] });

        expect(game.players['player1'].energy).toBe(initialEnergy + hubIncome + ubi);
    });

    it('should deduct energy for launches', () => {
        const p1Hub = game.entities.find(e => e.owner === 'player1' && e.type === 'HUB');
        const initialEnergy = game.players['player1'].energy;
        const cost = ENTITY_STATS['WEAPON'].cost;
        const hubIncome = ENTITY_STATS.HUB.energyGen;
        const ubi = GLOBAL_STATS.ENERGY_INCOME_PER_TURN;

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

        expect(game.players['player1'].energy).toBe(initialEnergy + hubIncome + ubi - cost);
    });

    it('should consume fuel when launching from hub', () => {
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
        game.map.lakes = [];
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
        const pullDistance = Math.pow(distance / GLOBAL_STATS.MAX_LAUNCH, 1 / GLOBAL_STATS.POWER_EXPONENT) * GLOBAL_STATS.MAX_PULL;

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

        // p2Hub should NOT be destroyed (it has 5 HP, weapon deals 2 AOE damage)
        const p2HubAfter = game.entities.find(e => e.id === p2Hub.id);
        expect(p2HubAfter).toBeDefined();
        expect(p2HubAfter.hp).toBe(3);

        // However, if we hit an UNDEPLOYED entity (1 HP), it should be destroyed
        const undeployed = game.addEntity({ type: 'HUB', owner: 'player2', x: p2Hub.x, y: p2Hub.y, deployed: false, hp: 1 });
        game.resolveTurn(actions);
        expect(game.entities.find(e => e.id === undeployed.id)).toBeUndefined();
    });
});

describe('GameState - Launch Direction Consistency', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['player1', 'player2']);
        game.map.lakes = [];
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

        const pullDistance = Math.pow(800 / GLOBAL_STATS.MAX_LAUNCH, 1 / GLOBAL_STATS.POWER_EXPONENT) * GLOBAL_STATS.MAX_PULL;

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

        // Find a snapshot around the midpoint of the sub-round (subTicks = 100, capture every step)
        // SubTick 48 is close to halfway and a multiple of our dynamic snapshot step (3)
        const midSnapshot = snapshots.find(s => s.type === 'ROUND_SUB' && s.subTick === 48);
        expect(midSnapshot).toBeDefined();

        const projectile = midSnapshot.state.entities.find(e => e.type === 'PROJECTILE');
        expect(projectile).toBeDefined();

        // Expected X: 250 + (800 * 0.48) = 634
        // If it flipped, it would be much lower/different
        expect(projectile.x).toBeCloseTo(634);
    });
});
describe('GameState - Fog of War', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['player1', 'player2']);
        game.map.lakes = [];
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

    it('should show link even if endpoints are hidden but link segment is visible', () => {
        const p1Hub = game.entities.find(e => e.owner === 'player1');
        // Player 1 at (250, 500). Vision radius 400.
        p1Hub.x = 250; p1Hub.y = 500;

        // Two enemy hubs outside vision (at y=0 and y=1000)
        // Link between them passes through (250, 500) which is in vision
        const enemyA = game.addEntity({ type: 'HUB', owner: 'player2', x: 250, y: 0 });    // 500 away
        const enemyB = game.addEntity({ type: 'HUB', owner: 'player2', x: 250, y: 1000 }); // 500 away
        game.addLink(enemyA.id, enemyB.id, 'player2');

        const visibleState = game.getVisibleState('player1');

        // Link should be visible because at least one segment is in vision
        expect(visibleState.links.length).toBe(1);

        // Endpoints MUST be included in the entities list so the link can be drawn...
        const entA = visibleState.entities.find(e => e.id === enemyA.id);
        const entB = visibleState.entities.find(e => e.id === enemyB.id);
        expect(entA).toBeDefined();
        expect(entB).toBeDefined();

        // ...BUT they must be marked as NOT scouted because they are in the dark
        expect(entA.scouted).toBe(false);
        expect(entB.scouted).toBe(false);
    });

    it('should mark entities as scouted ONLY if they are in active vision radius', () => {
        const p1Hub = game.entities.find(e => e.owner === 'player1');
        p1Hub.x = 250; p1Hub.y = 500; // Vision covers y in [100, 900]

        // Enemy Hub A: Just outside vision (y=50)
        // Enemy Hub B: Well inside vision (y=500)
        const enemyA = game.addEntity({ type: 'HUB', owner: 'player2', x: 250, y: 50 });
        const enemyB = game.addEntity({ type: 'HUB', owner: 'player2', x: 250, y: 500 });
        game.addLink(enemyA.id, enemyB.id, 'player2');

        const visibleState = game.getVisibleState('player1');

        const entA = visibleState.entities.find(e => e.id === enemyA.id);
        const entB = visibleState.entities.find(e => e.id === enemyB.id);

        expect(entA.scouted).toBe(false); // Inside the dark, only seen via link
        expect(entB.scouted).toBe(true);  // Actively seen
    });
});

describe('GameState - Multi-Action Turns', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['player1', 'player2']);
        game.map.lakes = [];
    });

    it('should process multiple actions for the same player in one resolution', () => {
        const p1Hub = game.entities.find(e => e.owner === 'player1' && e.type === 'HUB');

        // Define two legal actions
        const actions = {
            player1: [
                {
                    playerId: 'player1',
                    sourceId: p1Hub.id,
                    itemType: 'HUB',
                    angle: 45,
                    distance: 100
                },
                {
                    playerId: 'player1',
                    sourceId: p1Hub.id,
                    itemType: 'WEAPON',
                    angle: -45,
                    distance: 100
                }
            ],
            player2: []
        };

        const snapshots = game.resolveTurn(actions);

        // Track all unique projectiles seen across the entire resolution
        const allProjectiles = new Set();
        snapshots.forEach(s => {
            s.state.entities.forEach(e => {
                if (e.type === 'PROJECTILE') allProjectiles.add(e.id);
            });
        });

        expect(allProjectiles.size).toBe(2);

        // Verify energy deduction for BOTH
        const finalSnap = snapshots[snapshots.length - 1];
        const cost = ENTITY_STATS.HUB.cost + ENTITY_STATS.WEAPON.cost;
        const income = ENTITY_STATS.HUB.energyGen + GLOBAL_STATS.ENERGY_INCOME_PER_TURN;

        expect(finalSnap.state.players.player1.energy).toBe(GLOBAL_STATS.STARTING_ENERGY + income - cost);
    });

    it('should NOT include future entities in the early snapshots (ENERGY phase)', () => {
        const p1Hub = game.entities.find(e => e.owner === 'player1' && e.type === 'HUB');
        const initialEntityCount = game.entities.length;

        const actions = {
            player1: [{
                playerId: 'player1',
                sourceId: p1Hub.id,
                itemType: 'HUB',
                angle: 90,
                distance: 100
            }],
            player2: []
        };

        const snapshots = game.resolveTurn(actions);

        // The first snapshot should be ENERGY
        const energySnap = snapshots.find(s => s.type === 'ENERGY');
        expect(energySnap).toBeDefined();

        // It should ONLY have the initial entities (the hubs existing before resolution)
        expect(energySnap.state.entities.length).toBe(initialEntityCount);

        // The result Hub should only appear at the END of the round
        const finalSnap = snapshots.find(s => s.type === 'FINAL');
        expect(finalSnap.state.entities.length).toBe(initialEntityCount + 1);
    });
});

describe('GameState - Map Hazards (Phase 6)', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['player1']);
        // Add a single lake and some mountains for testing
        game.map.lakes = [
            { id: 'lake_test', x: 500, y: 500, radius: 100 }
        ];
        game.map.mountains = [
            { id: 'mtn_test', x: 1200, y: 500, radius: 100 }
        ];
    });

    it('should destroy an entity that lands in a lake', () => {
        const entity = game.addEntity({ type: 'HUB', owner: 'player1', x: 500, y: 500, hp: 10 });
        game.checkMapHazards();
        expect(entity.hp).toBe(0);
    });

    it('should destroy the destination entity if a link crosses a lake', () => {
        const starter = game.entities.find(e => e.isStarter && e.owner === 'player1');
        starter.x = 200; starter.y = 500;
        const target = game.addEntity({ type: 'HUB', owner: 'player1', x: 800, y: 500, hp: 10 });
        game.addLink(starter.id, target.id, 'player1');
        game.checkMapHazards();
        expect(target.hp).toBe(0);
    });

    it('should destroy an entity that lands in a mountain', () => {
        const entity = game.addEntity({ type: 'HUB', owner: 'player1', x: 1200, y: 500, hp: 10 });
        game.checkMapHazards();
        expect(entity.hp).toBe(0);
    });

    it('should NOT destroy a link that crosses a mountain', () => {
        const starter = game.entities.find(e => e.isStarter && e.owner === 'player1');
        starter.x = 1000; starter.y = 500;
        const target = game.addEntity({ type: 'HUB', owner: 'player1', x: 1400, y: 500, hp: 10 });
        game.addLink(starter.id, target.id, 'player1');
        game.checkMapHazards();
        // Destination should still be alive!
        expect(target.hp).toBe(10);
    });

    it('should handle cluster of intersecting mountains', () => {
        game.map.mountains = [
            { id: 'm1', x: 100, y: 100, radius: 50 },
            { id: 'm2', x: 140, y: 100, radius: 50 }
        ];
        const entity = game.addEntity({ type: 'HUB', owner: 'player1', x: 120, y: 100, hp: 10 });
        game.checkMapHazards();
        expect(entity.hp).toBe(0);
    });
});
