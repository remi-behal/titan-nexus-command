import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVisualInterpolation } from './useVisualInterpolation';
import { audioManager } from '../utils/AudioManager';

// Mock AudioManager to spy on sound play calls
vi.mock('../utils/AudioManager', () => ({
    audioManager: {
        playHeavyLaunch: vi.fn(),
        playSamLaunch: vi.fn(),
        playShoot: vi.fn(),
        playLaser: vi.fn(),
        playNukeDetonation: vi.fn(),
        playExplosion: vi.fn(),
        playShieldHit: vi.fn(),
        playStructureLanding: vi.fn(),
        playSamLockOn: vi.fn(),
        playStructureDestroyed: vi.fn(),
        playLinkSevered: vi.fn(),
        playLowBuzz: vi.fn(),
    }
}));

describe('useVisualInterpolation SFX triggers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize empty visual entities and links refs', () => {
        const { result } = renderHook(() => useVisualInterpolation());
        
        expect(result.current.visualEntities.current).toEqual({});
        expect(result.current.visualLinks.current).toEqual({});
        expect(typeof result.current.updateInterpolation).toBe('function');
    });

    it('should handle null gameState safely', () => {
        const { result } = renderHook(() => useVisualInterpolation());
        const outcome = result.current.updateInterpolation(null, 'player1');
        
        expect(outcome.visualEntities).toEqual({});
        expect(outcome.visualLinks).toEqual({});
        expect(outcome.isInVision(0, 0)).toBe(true);
    });

    it('should not play structure landing sound on the first state update', () => {
        const { result } = renderHook(() => useVisualInterpolation());
        
        const initialGameState = {
            turn: 1,
            phase: 'PLANNING',
            map: { width: 2000, height: 2000 },
            entities: [
                { id: 'hub-1', type: 'HUB', x: 100, y: 100, owner: 'player1' }
            ],
            links: [],
            audibleEvents: []
        };

        result.current.updateInterpolation(initialGameState, 'player1');
        
        // AudioManager.playStructureLanding should NOT be called on initial mount/first update
        expect(audioManager.playStructureLanding).not.toHaveBeenCalled();
    });

    it('should not play structure landing sound on mid-game mount first update', () => {
        const { result } = renderHook(() => useVisualInterpolation());
        
        const midGameState = {
            turn: 2,
            phase: 'RESOLVING',
            map: { width: 2000, height: 2000 },
            entities: [
                { id: 'hub-1', type: 'HUB', x: 100, y: 100, owner: 'player1' }
            ],
            links: [],
            audibleEvents: []
        };

        result.current.updateInterpolation(midGameState, 'player1');
        expect(audioManager.playStructureLanding).not.toHaveBeenCalled();
    });

    it('should play structure landing sound on subsequent updates when new structures spawn', () => {
        const { result } = renderHook(() => useVisualInterpolation());
        
        const state1 = {
            turn: 1,
            phase: 'PLANNING',
            map: { width: 2000, height: 2000 },
            entities: [
                { id: 'hub-1', type: 'HUB', x: 100, y: 100, owner: 'player1' }
            ],
            links: [],
            audibleEvents: []
        };

        const state2 = {
            turn: 1,
            phase: 'RESOLVING',
            map: { width: 2000, height: 2000 },
            entities: [
                { id: 'hub-1', type: 'HUB', x: 100, y: 100, owner: 'player1' },
                { id: 'extractor-1', type: 'EXTRACTOR', x: 200, y: 200, owner: 'player1' }
            ],
            links: [],
            audibleEvents: []
        };

        // First update initializes visual entities list without sounds
        result.current.updateInterpolation(state1, 'player1');
        expect(audioManager.playStructureLanding).not.toHaveBeenCalled();

        // Second update spawns extractor-1, which should trigger the sound
        result.current.updateInterpolation(state2, 'player1');
        expect(audioManager.playStructureLanding).toHaveBeenCalledTimes(1);
        expect(audioManager.playStructureLanding).toHaveBeenCalledWith(200, 200);
    });

    it('should not play FOW audible events on the first state update, but should play them subsequently', () => {
        const { result } = renderHook(() => useVisualInterpolation());
        
        const state1 = {
            turn: 1,
            phase: 'PLANNING',
            map: { width: 2000, height: 2000 },
            entities: [],
            links: [],
            audibleEvents: [
                { id: 'evt-1', type: 'STRUCTURE_LANDING', x: 500, y: 500 }
            ]
        };

        const state2 = {
            turn: 1,
            phase: 'RESOLVING',
            map: { width: 2000, height: 2000 },
            entities: [],
            links: [],
            audibleEvents: [
                { id: 'evt-1', type: 'STRUCTURE_LANDING', x: 500, y: 500 },
                { id: 'evt-2', type: 'STRUCTURE_LANDING', x: 600, y: 600 }
            ]
        };

        // First update skips playing the event, but marks it as played
        result.current.updateInterpolation(state1, 'player1');
        expect(audioManager.playStructureLanding).not.toHaveBeenCalled();

        // First update has a new event, which should trigger the sound
        result.current.updateInterpolation(state2, 'player1');
        expect(audioManager.playStructureLanding).toHaveBeenCalledTimes(1);
        expect(audioManager.playStructureLanding).toHaveBeenCalledWith(600, 600);
    });

    it('should play spatialized SAM flight sounds periodically for both in-vision and out-of-vision missiles, respecting the 150ms throttle', () => {
        const { result } = renderHook(() => useVisualInterpolation());
        
        let mockTime = 1000000;
        const timeSpy = vi.spyOn(Date, 'now').mockImplementation(() => mockTime);

        const state1 = {
            turn: 1,
            phase: 'PLANNING',
            map: { width: 2000, height: 2000 },
            entities: [
                { id: 'sam-1', type: 'PROJECTILE', itemType: 'SAM_MISSILE', x: 100, y: 150, owner: 'player1' },
                { id: 'homing-1', type: 'PROJECTILE', itemType: 'HOMING_MISSILE', x: 300, y: 350, owner: 'player1' }
            ],
            links: [],
            audibleEvents: [
                { id: 'sam-2', type: 'PROJECTILE', itemType: 'SMART_SAM_MISSILE', x: 200, y: 250 }
            ]
        };

        const state2 = {
            ...state1,
            phase: 'RESOLVING'
        };

        // 1. First update: suppress the flight sounds
        result.current.updateInterpolation(state1, 'player1');
        expect(audioManager.playLowBuzz).not.toHaveBeenCalled();

        // 2. Second update: first active tick, plays flight sounds for all three
        mockTime += 100;
        result.current.updateInterpolation(state2, 'player1');
        expect(audioManager.playLowBuzz).toHaveBeenCalledTimes(3);
        expect(audioManager.playLowBuzz).toHaveBeenNthCalledWith(1, 100, 150);
        expect(audioManager.playLowBuzz).toHaveBeenNthCalledWith(2, 300, 350);
        expect(audioManager.playLowBuzz).toHaveBeenNthCalledWith(3, 200, 250);

        // 3. Third update (+100ms): throttled, does not play again
        mockTime += 100;
        result.current.updateInterpolation(state2, 'player1');
        expect(audioManager.playLowBuzz).toHaveBeenCalledTimes(3); // Still 3 total calls

        // 4. Fourth update (+200ms since play): plays again
        mockTime += 100;
        result.current.updateInterpolation(state2, 'player1');
        expect(audioManager.playLowBuzz).toHaveBeenCalledTimes(6); // 3 more calls

        timeSpy.mockRestore();
    });
});
