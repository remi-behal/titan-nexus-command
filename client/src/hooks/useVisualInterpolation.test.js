import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVisualInterpolation } from './useVisualInterpolation';

describe('useVisualInterpolation', () => {
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
});
