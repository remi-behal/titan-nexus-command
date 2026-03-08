import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from './GameState.js';
import { ENTITY_STATS, GLOBAL_STATS } from './EntityStats.js';

describe('Economy Expansion - Energy Generation', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['player1']);
    });

    it('should generate energy from Hubs', () => {
        const initialEnergy = game.players['player1'].energy;
        const hubIncome = ENTITY_STATS.HUB.energyGen;
        const ubi = GLOBAL_STATS.ENERGY_INCOME_PER_TURN;

        game.resolveTurn({ player1: [] });

        expect(game.players['player1'].energy).toBe(initialEnergy + hubIncome + ubi);
    });

    it('should generate additional energy from Extractors', () => {
        const initialEnergy = game.players['player1'].energy;
        const hubIncome = ENTITY_STATS.HUB.energyGen;
        const extractorIncome = ENTITY_STATS.EXTRACTOR.energyGen;
        const ubi = GLOBAL_STATS.ENERGY_INCOME_PER_TURN;

        // Add an extractor
        game.addEntity({
            type: 'EXTRACTOR',
            owner: 'player1',
            x: 100,
            y: 100,
            hp: 2,
            deployed: true
        });

        game.resolveTurn({ player1: [] });

        expect(game.players['player1'].energy).toBe(initialEnergy + hubIncome + extractorIncome + ubi);
    });

    it('should give a bonus when Extractor is on a resource node', () => {
        const initialEnergy = game.players['player1'].energy;
        const hubIncome = ENTITY_STATS.HUB.energyGen;
        const extractorIncome = ENTITY_STATS.EXTRACTOR.energyGen;
        const ubi = GLOBAL_STATS.ENERGY_INCOME_PER_TURN;

        // Use one of the initializeGame mock nodes: { id: 'res1', x: 500, y: 300, value: 10 }
        const node = game.map.resources[0];
        const nodeBonus = node.value;

        // Place extractor on the node
        game.addEntity({
            type: 'EXTRACTOR',
            owner: 'player1',
            x: node.x,
            y: node.y,
            hp: 2,
            deployed: true
        });

        game.resolveTurn({ player1: [] });

        expect(game.players['player1'].energy).toBe(initialEnergy + hubIncome + extractorIncome + nodeBonus + ubi);
    });

    it('should give a bonus even if slightly misaligned (within radius)', () => {
        const initialEnergy = game.players['player1'].energy;
        const hubIncome = ENTITY_STATS.HUB.energyGen;
        const extractorIncome = ENTITY_STATS.EXTRACTOR.energyGen;
        const ubi = GLOBAL_STATS.ENERGY_INCOME_PER_TURN;

        const node = game.map.resources[0];
        const nodeBonus = node.value;

        // Place extractor slightly off-center but within capture radius
        game.addEntity({
            type: 'EXTRACTOR',
            owner: 'player1',
            x: node.x + GLOBAL_STATS.RESOURCE_CAPTURE_RADIUS - 1,
            y: node.y,
            hp: 2,
            deployed: true
        });

        game.resolveTurn({ player1: [] });

        expect(game.players['player1'].energy).toBe(initialEnergy + hubIncome + extractorIncome + nodeBonus + ubi);
    });

    it('should NOT give a bonus if outside radius', () => {
        const initialEnergy = game.players['player1'].energy;
        const hubIncome = ENTITY_STATS.HUB.energyGen;
        const extractorIncome = ENTITY_STATS.EXTRACTOR.energyGen;
        const ubi = GLOBAL_STATS.ENERGY_INCOME_PER_TURN;

        const node = game.map.resources[0];

        // Place extractor outside capture radius
        game.addEntity({
            type: 'EXTRACTOR',
            owner: 'player1',
            x: node.x + GLOBAL_STATS.RESOURCE_CAPTURE_RADIUS + 5,
            y: node.y,
            hp: 2,
            deployed: true
        });

        game.resolveTurn({ player1: [] });

        expect(game.players['player1'].energy).toBe(initialEnergy + hubIncome + extractorIncome + ubi);
    });

    it('should handle toroidal wrapping for node capture', () => {
        const initialEnergy = game.players['player1'].energy;
        const hubIncome = ENTITY_STATS.HUB.energyGen;
        const extractorIncome = ENTITY_STATS.EXTRACTOR.energyGen;
        const ubi = GLOBAL_STATS.ENERGY_INCOME_PER_TURN;

        // Define a node at the very edge
        const node = { id: 'edge-res', x: 1995, y: 1000, value: 50 };
        game.map.resources.push(node);

        // Place extractor wrapped around the edge (e.g., at x=5)
        game.addEntity({
            type: 'EXTRACTOR',
            owner: 'player1',
            x: 5,
            y: 1000,
            hp: 2,
            deployed: true
        });

        game.resolveTurn({ player1: [] });

        expect(game.players['player1'].energy).toBe(initialEnergy + hubIncome + extractorIncome + 50 + ubi);
    });

    it('should generate high yield (20) for extractor on super node', () => {
        const initialEnergy = game.players['player1'].energy;
        const hubIncome = ENTITY_STATS.HUB.energyGen;
        const extractorIncome = ENTITY_STATS.EXTRACTOR.energyGen;
        const ubi = GLOBAL_STATS.ENERGY_INCOME_PER_TURN;

        // Find the super node from initialization (value 15)
        const superNode = game.map.resources.find(r => r.isSuper);

        game.addEntity({
            type: 'EXTRACTOR',
            owner: 'player1',
            x: superNode.x,
            y: superNode.y,
            hp: 2,
            deployed: true
        });

        game.resolveTurn({ player1: [] });

        // Income = UBI (10) + Hub (5) + Extractor (5) + Node (15) = 35 total increment
        // So total energy = initial + 35
        expect(game.players['player1'].energy).toBe(initialEnergy + hubIncome + extractorIncome + superNode.value + ubi);
    });
});
