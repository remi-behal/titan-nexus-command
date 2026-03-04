import { describe, it, expect } from 'vitest';
import { shouldHighlightRing } from './uiLogic.js';

describe('Sling Ring Highlight Logic', () => {
    const RADIUS = 80;

    it('should highlight when mouse is inside radius (hover)', () => {
        expect(shouldHighlightRing(40, RADIUS, false)).toBe(true);
    });

    it('should not highlight when mouse is outside radius (no hover)', () => {
        expect(shouldHighlightRing(90, RADIUS, false)).toBe(false);
    });

    it('should stay highlighted when aiming, even if mouse is outside', () => {
        expect(shouldHighlightRing(150, RADIUS, true)).toBe(true);
    });
});
