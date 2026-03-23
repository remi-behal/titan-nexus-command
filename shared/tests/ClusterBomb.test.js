
import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';
import { ENTITY_STATS, GLOBAL_STATS } from '../constants/EntityStats.js';

describe('GameState - Cluster Bomb', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['player1', 'player2']);
        game.map.lakes = [];
        game.map.mountains = [];
    });

    it('should split into multiple sub-bombs mid-flight', () => {
        const p1Hub = game.entities.find(e => e.owner === 'player1' && e.type === 'HUB');
        p1Hub.x = 500;
        p1Hub.y = 500;

        const actions = {
            player1: [{
                playerId: 'player1',
                sourceId: p1Hub.id,
                itemType: 'CLUSTER_BOMB',
                angle: 0, // Right
                distance: 200 // Launch to (700, 500)
            }],
            player2: []
        };

        const snapshots = game.resolveTurn(actions);

        // Find sub-bombs in snapshots
        const subBombsCountInSnapshots = snapshots.map(s => {
            if (s.type === 'ROUND_SUB') {
                return s.state.entities.filter(e => e.itemType === 'CLUSTER_BOMB').length;
            }
            return 0;
        });

        const maxSubBombs = Math.max(...subBombsCountInSnapshots);
        expect(maxSubBombs).toBe(ENTITY_STATS.CLUSTER_BOMB.subBombCount);

        // Verify that initially there is only 1 projectile
        const firstRoundSub = snapshots.find(s => s.type === 'ROUND_SUB');
        const initialProjCount = firstRoundSub.state.entities.filter(e => e.itemType === 'CLUSTER_BOMB').length;
        expect(initialProjCount).toBe(1);
    });

    it('should sub-bombs land in a line perpendicular to travel', () => {
        const p1Hub = game.entities.find(e => e.owner === 'player1' && e.type === 'HUB');
        p1Hub.x = 500;
        p1Hub.y = 500;

        const actions = {
            player1: [{
                playerId: 'player1',
                sourceId: p1Hub.id,
                itemType: 'CLUSTER_BOMB',
                angle: 0, // Right
                distance: 100 // Travel 100px Right to (600, 500)
            }],
            player2: []
        };

        const snapshots = game.resolveTurn(actions);
        const finalSnap = snapshots.find(s => s.type === 'FINAL');
        
        // Check explosions in the round sub-ticks
        const explosions = [];
        snapshots.forEach(s => {
            if (s.type === 'ROUND_SUB') {
                s.state.entities.forEach(e => {
                    if (e.type === 'EXPLOSION') {
                        // Check if we already recorded this explosion position
                        if (!explosions.some(ex => Math.abs(ex.x - e.x) < 1 && Math.abs(ex.y - e.y) < 1)) {
                            explosions.push({ x: e.x, y: e.y });
                        }
                    }
                });
            }
        });

        expect(explosions.length).toBe(ENTITY_STATS.CLUSTER_BOMB.subBombCount);

        const launchDistance = GameState.calculateLaunchDistance(100);
        const expectedX = 500 + launchDistance;

        // For a Right launch (angle 0), spread is perpendicular (UP/DOWN, along Y axis)
        // All explosions should have the same X (approx 636)
        explosions.forEach(ex => {
            expect(ex.x).toBeCloseTo(expectedX, 1);
            // Y should be centered around 500
            expect(ex.y).toBeGreaterThanOrEqual(500 - ENTITY_STATS.CLUSTER_BOMB.spreadDistance/2 - 1);
            expect(ex.y).toBeLessThanOrEqual(500 + ENTITY_STATS.CLUSTER_BOMB.spreadDistance/2 + 1);
        });

        // Check if Y coordinates are distinct
        const ys = explosions.map(ex => Math.round(ex.y)).sort((a,b) => a-b);
        for(let i=0; i < ys.length - 1; i++) {
            expect(ys[i+1] - ys[i]).toBeGreaterThan(0);
        }
    });

    it('should deal damage with sub-bombs', () => {
        game.entities = []; // Clear all hubs to prevent link decay issues
        const p1Hub = game.addEntity({ type: 'HUB', owner: 'player1', x: 500, y: 500, isStarter: true });
        
        const launchDistance = GameState.calculateLaunchDistance(100);
        const expectedX = 500 + launchDistance;

        // Place a target near where one of the sub-bombs will land
        const target = game.addEntity({ type: 'HUB', owner: 'player2', x: expectedX, y: 550, hp: 10, isStarter: true });

        const actions = {
            player1: [{
                playerId: 'player1',
                sourceId: p1Hub.id,
                itemType: 'CLUSTER_BOMB',
                angle: 0,
                distance: 100
            }],
            player2: []
        };

        game.resolveTurn(actions);

        const targetAfter = game.entities.find(e => e.id === target.id);
        expect(targetAfter).toBeDefined();
        expect(targetAfter.hp).toBeLessThan(10);
    });
});
