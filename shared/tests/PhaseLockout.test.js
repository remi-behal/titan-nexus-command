import { describe, it, expect } from 'vitest';
import { GameState } from '../GameState.js';

describe('GameState - Phase Lockout', () => {
    it('should initialize in PLANNING phase', () => {
        const game = new GameState();
        expect(game.phase).toBe('PLANNING');
    });

    it('should transition to RESOLVING during resolveTurn and STAY in RESOLVING', () => {
        const game = new GameState();
        game.initializeGame(['p1', 'p2']);

        game.resolveTurn({});
        expect(game.phase).toBe('RESOLVING');
    });

    it('should reflect RESOLVING phase in state snapshots', () => {
        const game = new GameState();
        game.initializeGame(['p1', 'p2']);

        const snapshots = game.resolveTurn({
            p1: [{ type: 'LAUNCH', itemType: 'HUB', sourceId: 'starter', distance: 100, angle: 0 }]
        });

        // Every snapshot (except the very last one potentially) should ideally show the phase as it transitions
        // In our implementation, resolveTurn sets phase=RESOLVING, then snapshots are taken.
        // The last snapshot takes a state after turn increment.

        const midSnapshot = snapshots.find((s) => s.type === 'ROUND_START' || s.type === 'ENERGY');
        expect(midSnapshot.state.phase).toBe('RESOLVING');
    });
});
