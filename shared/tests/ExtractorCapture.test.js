import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';
import { ENTITY_STATS, GLOBAL_STATS } from '../constants/EntityStats.js';

describe('Extractor Capture Logic', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['p1', 'p2']);
    });

    it('should set isCapturing to true when placed near a resource node', () => {
        // res1 is at 500, 250
        const extractor = game.addEntity({
            type: 'EXTRACTOR',
            owner: 'p1',
            x: 500,
            y: 250,
            deployed: true
        });

        expect(extractor.isCapturing).toBe(true);
        expect(extractor.capturedNodeId).toBe('res1');
    });

    it('should set isCapturing to false when placed away from resource nodes', () => {
        const extractor = game.addEntity({
            type: 'EXTRACTOR',
            owner: 'p1',
            x: 0,
            y: 0,
            deployed: true
        });

        expect(extractor.isCapturing).toBe(false);
        expect(extractor.capturedNodeId).toBe(null);
    });

    it('should update capture status during turn resolution', () => {
        const extractor = game.addEntity({
            type: 'EXTRACTOR',
            owner: 'p1',
            x: 0,
            y: 0,
            deployed: true
        });

        expect(extractor.isCapturing).toBe(false);

        // Manually move it to a node
        extractor.x = 500;
        extractor.y = 250;

        game.resolveTurn({ p1: [], p2: [] });

        expect(extractor.isCapturing).toBe(true);
        expect(extractor.capturedNodeId).toBe('res1');
    });

    it('should only generate bonus energy when capturing a node', () => {
        const p1 = game.players.p1;
        const initialEnergy = p1.energy;

        // Place one connected, one disconnected
        game.addEntity({ type: 'EXTRACTOR', owner: 'p1', x: 500, y: 250, deployed: true }); // Captured res1 (value 5)
        game.addEntity({ type: 'EXTRACTOR', owner: 'p1', x: 0, y: 0, deployed: true }); // Not captured

        game.resolveTurn({ p1: [], p2: [] });

        // Income = UBI (10) + HUB energyGen (0) + 2x Extractor base (5 each) + 1x Node bonus (5) = 25
        const expectedIncome = 10 + 0 + (5 * 2) + 5;
        expect(p1.energy).toBe(initialEnergy + expectedIncome);
    });
});
