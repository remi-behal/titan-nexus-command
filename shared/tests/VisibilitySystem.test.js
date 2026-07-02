import { describe, it, expect } from 'vitest';
import { VisibilitySystem } from '../systems/VisibilitySystem.js';

describe('VisibilitySystem Interface', () => {
    it('should export the expected visibility methods', () => {
        expect(VisibilitySystem).toBeDefined();
        expect(VisibilitySystem.isPositionVisible).toBeTypeOf('function');
        expect(VisibilitySystem.isPositionCloaked).toBeTypeOf('function');
        expect(VisibilitySystem.getVisionCircles).toBeTypeOf('function');
        expect(VisibilitySystem.updateScouting).toBeTypeOf('function');
        expect(VisibilitySystem.getVisibleState).toBeTypeOf('function');
    });
});
