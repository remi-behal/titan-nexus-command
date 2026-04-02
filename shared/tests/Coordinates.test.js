import { describe, it, expect } from 'vitest';
import { GameState } from '../GameState.js';

describe('Coordinate Math Stability', () => {
    const W = 2000;
    const H = 2000;

    it('getToroidalVector should never return NaN', () => {
        const testCases = [
            { x1: 0, y1: 0, x2: 100, y2: 100 },
            { x1: 1990, y1: 1990, x2: 10, y2: 10 }, // Wrap
            { x1: NaN, y1: 0, x2: 100, y2: 100 },
            { x1: 0, y1: Infinity, x2: 100, y2: 100 },
            { x1: 0, y1: 0, x2: 100, y2: 100, w: 0, h: 0 }
        ];

        testCases.forEach(c => {
            const result = GameState.getToroidalVector(c.x1, c.y1, c.x2, c.y2, c.w || W, c.h || H);
            expect(result.dx).not.toBe(NaN);
            expect(result.dy).not.toBe(NaN);
        });
    });

    it('calculateLaunchAngle should handle zero vectors safely', () => {
        expect(GameState.calculateLaunchAngle(0, 0)).toBe(0);
        expect(GameState.calculateLaunchAngle(NaN, 0)).toBe(0);
    });

    it('getToroidalDistance should be non-negative and finite', () => {
        const gs = new GameState(W, H);
        const d1 = gs.getToroidalDistance(0, 0, 100, 100);
        expect(d1).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(d1)).toBe(true);

        const d2 = gs.getToroidalDistance(NaN, 0, 100, 100);
        expect(d2).toBe(0); // Should fall back to 0 on error
    });
});
