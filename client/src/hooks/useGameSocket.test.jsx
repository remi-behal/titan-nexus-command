import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameSocket } from './useGameSocket';

describe('useGameSocket hook', () => {
    it('initializes socket states', () => {
        const { result } = renderHook(() => useGameSocket());
        expect(result.current.isConnected).toBeDefined();
        expect(result.current.chatMessages).toBeInstanceOf(Array);
        expect(result.current.committedActions).toBeInstanceOf(Array);
    });
});
