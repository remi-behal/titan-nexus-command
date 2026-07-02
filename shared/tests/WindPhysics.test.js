import { describe, it, expect } from 'vitest';
import { GameState } from '../GameState.js';

describe('Wind Physics Drift', () => {
    it('should drift a standard projectile over its flight duration', () => {
        const gs = new GameState();
        gs.initializeGame(['p1', 'p2']);
        gs.map.modifiers = { windEnabled: true };
        
        // Force active wind blowing directly East (angle 0) at 1px/sub-tick
        gs.windState = {
            active: true,
            angle: 0,
            speed: 1,
            dx: 1,
            dy: 0,
            duration: 5,
            cooldown: 0
        };

        gs.entities = []; // Clear default starter hubs to prevent interference
        gs.addEntity({
            id: 'h1',
            type: 'HUB',
            owner: 'p1',
            x: 100,
            y: 100,
            hp: 5,
            deployed: true,
            isStarter: true
        });

        // Launch standard WEAPON (dumb bomb) at angle 90 (Straight South)
        const snapshots = gs.resolveTurn({
            p1: [
                {
                    playerId: 'p1',
                    sourceId: 'h1',
                    itemType: 'WEAPON',
                    angle: 90,
                    distance: 150 // Pull distance
                }
            ]
        });

        // Find sub-tick 18 snapshot (divisible by 6)
        const subTick18 = snapshots.find(s => s.type === 'ROUND_SUB' && s.subTick === 18);
        expect(subTick18).toBeDefined();

        const proj = subTick18.state.entities.find(e => e.type === 'PROJECTILE' && e.itemType === 'WEAPON');
        expect(proj).toBeDefined();
        
        // Wind is dx = 1 px/sub-tick. At tick 18, the projectile should have drifted by 18px East (X should be 100 + 18 = 118).
        expect(Math.round(proj.x)).toBe(118);
    });

    it('should apply wind step drift to homing/seeker missiles', () => {
        const gs = new GameState();
        gs.initializeGame(['p1', 'p2']);
        gs.map.modifiers = { windEnabled: true };

        // Wind blowing North (angle 270) at 1px/sub-tick
        gs.windState = {
            active: true,
            angle: 270,
            speed: 1,
            dx: 0,
            dy: -1,
            duration: 5,
            cooldown: 0
        };

        gs.entities = [];
        gs.addEntity({
            id: 'h1',
            type: 'HUB',
            owner: 'p1',
            x: 100,
            y: 100,
            hp: 5,
            deployed: true,
            isStarter: true
        });

        // Launch HOMING_MISSILE East (angle 0)
        const snapshots = gs.resolveTurn({
            p1: [
                {
                    playerId: 'p1',
                    sourceId: 'h1',
                    itemType: 'HOMING_MISSILE',
                    angle: 0,
                    distance: 100
                }
            ]
        });

        const subTick12 = snapshots.find(s => s.type === 'ROUND_SUB' && s.subTick === 12);
        expect(subTick12).toBeDefined();
        const missile = subTick12.state.entities.find(e => e.type === 'PROJECTILE' && e.itemType === 'HOMING_MISSILE');
        expect(missile).toBeDefined();
        
        // Homing missile started at y=100. Without wind, y=100. With wind dy=-1, y should be less than 100.
        expect(missile.y).toBeLessThan(100);
    });
});
