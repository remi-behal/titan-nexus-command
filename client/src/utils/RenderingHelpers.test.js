import { describe, it, expect } from 'vitest';
import { wrapCoordinate, getToroidalLineSegments, worldToScreen, getGhostColor } from './RenderingHelpers.js';

describe('Rendering Helpers', () => {
    it('wrapCoordinate should handle negative and over-max values', () => {
        expect(wrapCoordinate(-10, 100)).toBe(90);
        expect(wrapCoordinate(110, 100)).toBe(10);
        expect(wrapCoordinate(0, 100)).toBe(0);
    });

    it('getToroidalLineSegments should calculate the shortest path', () => {
        const mapW = 1000;
        const mapH = 1000;

        // No wrap
        const p1 = { x: 100, y: 100 };
        const p2 = { x: 200, y: 200 };
        const s1 = getToroidalLineSegments(p1, p2, mapW, mapH);
        expect(s1[0].x2).toBe(200);
        expect(s1[0].y2).toBe(200);

        // Wrap X (Right to Left)
        const p3 = { x: 900, y: 500 };
        const p4 = { x: 100, y: 500 };
        const s2 = getToroidalLineSegments(p3, p4, mapW, mapH);
        // Correct shortest target is 1100 (900 -> 1100)
        expect(s2[0].x2).toBe(1100);
    });

    it('worldToScreen should correctly project world pos with camera and zoom', () => {
        const worldX = 500;
        const worldY = 500;
        const camera = { x: 100, y: 100 };
        const zoom = 2;
        const screen = worldToScreen(worldX, worldY, camera, zoom);
        // (500 - 100) * 2 = 800
        expect(screen.x).toBe(800);
        expect(screen.y).toBe(800);
    });

    describe('getGhostColor', () => {
        it('should transform highly saturated HSL to target ghost saturation', () => {
            expect(getGhostColor('hsl(0, 70%, 50%)', '35%')).toBe('hsl(0, 35%, 50%)');
            expect(getGhostColor('hsl(120, 100%, 25%)', '10%')).toBe('hsl(120, 10%, 25%)');
        });
        it('should fallback to gray for non-HSL colors', () => {
            expect(getGhostColor('#ff0000')).toBe('#888');
            expect(getGhostColor('rgb(255, 0, 0)')).toBe('#888');
        });
    });
});
