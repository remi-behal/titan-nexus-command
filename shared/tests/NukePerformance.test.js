import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';

describe('Nuke Resolution Performance', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['p1', 'p2']);
    });

    it('should resolve a nuke detonation turn with minimal snapshots if no other actions exist', () => {
        // 1. Setup a Nuke about to detonate
        const nuke = game.addEntity({
            type: 'NUKE',
            x: 500,
            y: 500,
            owner: 'p1',
            detonationTurn: 1,
            deployed: true
        });

        // 2. Resolve the turn with NO actions
        const snapshots = game.resolveTurn({ p1: [], p2: [] });

        // 3. Analyze snapshots
        const detonationSnaps = snapshots.filter(s => s.type === 'DETONATION');
        const roundSnaps = snapshots.filter(s => s.type === 'ROUND');
        const subSnaps = snapshots.filter(s => s.type === 'ROUND_SUB');

        console.log(`[Perf] Snapshots generated:`);
        console.log(` - DETONATION: ${detonationSnaps.length}`);
        console.log(` - ROUND: ${roundSnaps.length}`);
        console.log(` - ROUND_SUB: ${subSnaps.length}`);
        console.log(` - TOTAL: ${snapshots.length}`);

        // Expectations: 
        // 1 DETONATION
        // 1 ROUND (because we force 1 for the hazard)
        // 0 ROUND_SUB (ideally, if nothing moved)
        expect(detonationSnaps.length).toBe(1);
        expect(roundSnaps.length).toBe(1);

        // This is the current "bloat": 
        // If this is > 0 when no projectiles are moving, it's inefficient.
        // Currently it will be around 20.
        expect(subSnaps.length).toBeLessThan(5);
    });
});
