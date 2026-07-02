import { describe, it, expect } from 'vitest';
import { GameState } from '../GameState.js';

describe('Wind Weather Scheduler', () => {
    it('should stay disabled if map modifier is missing', () => {
        const gs = new GameState();
        gs.initializeGame(['p1', 'p2']);
        gs.map.modifiers = {};
        
        gs.updateWindCycle();
        expect(gs.windState.active).toBe(false);
    });

    it('should cycle through storm active/inactive durations', () => {
        const gs = new GameState();
        gs.initializeGame(['p1', 'p2']);
        gs.map.modifiers = { windEnabled: true };
        
        // Mock default state
        gs.windState = {
            active: false,
            angle: 0,
            speed: 0,
            duration: 0,
            cooldown: 2
        };

        // Turn 1: Decrements cooldown to 1
        gs.updateWindCycle();
        expect(gs.windState.active).toBe(false);
        expect(gs.windState.cooldown).toBe(1);

        // Turn 2: Decrements cooldown to 0, triggers wind
        gs.updateWindCycle();
        expect(gs.windState.active).toBe(true);
        expect(gs.windState.duration).toBeGreaterThanOrEqual(3);
        expect(gs.windState.duration).toBeLessThanOrEqual(6);
        expect(gs.windState.speed).toBeGreaterThanOrEqual(0.5);
        expect(gs.windState.speed).toBeLessThanOrEqual(1.5);
        expect(gs.windState.cooldown).toBe(0);

        // Force duration to 1 to test storm completion
        gs.windState.duration = 1;
        gs.updateWindCycle();
        expect(gs.windState.active).toBe(false);
        expect(gs.windState.speed).toBe(0);
        expect(gs.windState.cooldown).toBeGreaterThanOrEqual(10);
    });
});
