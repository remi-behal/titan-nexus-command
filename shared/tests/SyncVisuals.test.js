import { describe, it, expect } from 'vitest';
import { GameState } from '../GameState.js';

describe('GameState - Sync Visuals', () => {
    it('should generate a start-of-round snapshot before simulation sub-ticks', () => {
        const game = new GameState();
        game.initializeGame(['player1', 'player2']);

        // Setup initial energy so player can afford the shot
        game.players.player1.energy = 100;

        const p1Hub = game.entities.find((e) => e.owner === 'player1' && e.type === 'HUB');

        const actions = {
            player1: [
                {
                    playerId: 'player1',
                    type: 'LAUNCH',
                    itemType: 'WEAPON',
                    sourceId: p1Hub.id,
                    sourceX: p1Hub.x,
                    sourceY: p1Hub.y,
                    angle: 0,
                    distance: 100
                }
            ],
            player2: []
        };

        const snapshots = game.resolveTurn(actions);

        // Find all snapshots within round 1
        const r1Snapshots = snapshots.filter((s) => s.round === 1);

        // The very first snapshot within a round should NOT be a sub-tick,
        // it should be an explicit marker for the start of the round
        // which helps the client synchronize the "Round X" banner before animation starts
        expect(r1Snapshots[0].type).toBe('ROUND_START');
    });
});
