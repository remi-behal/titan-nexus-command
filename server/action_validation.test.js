import { describe, it, expect } from 'vitest';
import { validateActions } from './utils/ActionValidator.js';

describe('Server - Action Validation', () => {
    const game = {
        turn: 1,
        players: {
            player1: { energy: 50 },
            player2: { energy: 10 }
        },
        entities: [
            { id: 'hub-p1', type: 'HUB', owner: 'player1', fuel: 2 },
            { id: 'hub-p2', type: 'HUB', owner: 'player2', fuel: 1 },
            { id: 'hub-emp', type: 'HUB', owner: 'player1', fuel: 1, disabledUntilTurn: 2 }
        ]
    };

    it('should accept valid actions', () => {
        const actions = [
            { sourceId: 'hub-p1', itemType: 'HUB', distance: 100, angle: 0 }
        ];
        const validated = validateActions(actions, 'player1', game);
        expect(validated.length).toBe(1);
        expect(validated[0].sourceId).toBe('hub-p1');
    });

    it('should reject actions from entities not owned by the player', () => {
        const actions = [
            { sourceId: 'hub-p2', itemType: 'HUB', distance: 100, angle: 0 }
        ];
        const validated = validateActions(actions, 'player1', game);
        expect(validated.length).toBe(0);
    });

    it('should reject actions if player has insufficient energy', () => {
        const actions = [
            { sourceId: 'hub-p1', itemType: 'HUB', distance: 100, angle: 0 },
            { sourceId: 'hub-p1', itemType: 'HUB', distance: 100, angle: 0 },
            { sourceId: 'hub-p1', itemType: 'HUB', distance: 100, angle: 0 }
        ];
        const validated = validateActions(actions, 'player1', game);
        expect(validated.length).toBe(2); // First 2 cost 40 (energy is 50, 3rd exceeds energy limit)
    });

    it('should reject actions exceeding source entity fuel limit', () => {
        const actions = [
            { sourceId: 'hub-p1', itemType: 'HUB', distance: 100, angle: 0 },
            { sourceId: 'hub-p1', itemType: 'HUB', distance: 100, angle: 0 },
            { sourceId: 'hub-p1', itemType: 'HUB', distance: 100, angle: 0 }
        ];
        // Ensure game energy is updated for this subtest so fuel limit triggers first
        const gameWithMoreEnergy = {
            ...game,
            players: { player1: { energy: 100 } }
        };
        const validated = validateActions(actions, 'player1', gameWithMoreEnergy);
        expect(validated.length).toBe(2); // Limited by hub-p1 fuel = 2
    });

    it('should reject actions from source entity disabled by EMP', () => {
        const actions = [
            { sourceId: 'hub-emp', itemType: 'HUB', distance: 100, angle: 0 }
        ];
        const validated = validateActions(actions, 'player1', game);
        expect(validated.length).toBe(0);
    });
});
