import { describe, it, expect } from 'vitest';
import { toroidalLerp } from './useVisualInterpolation.js';

describe('Toroidal Lerp Position Math', () => {
    it('should correctly interpolate positions across the toroidal boundaries', () => {
        const mapW = 1000;
        const LERP_FACTOR = 0.3;

        // Visual position is at 990, server position wraps to 10
        // Expected move is clockwise/right: 990 -> 1000/0 -> 10. Total dx = 20.
        const currentX = 990;
        const targetX = 10;

        const newX = toroidalLerp(currentX, targetX, mapW, LERP_FACTOR);
        expect(newX).toBe(996);
    });

    it('should correctly interpolate positions normally without wrapping', () => {
        const mapW = 1000;
        const LERP_FACTOR = 0.3;

        const currentX = 100;
        const targetX = 200;

        const newX = toroidalLerp(currentX, targetX, mapW, LERP_FACTOR);
        expect(newX).toBe(130);
    });
});
