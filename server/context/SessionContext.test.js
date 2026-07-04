import { describe, it, expect } from 'vitest';
import { SessionContext } from './SessionContext.js';

describe('SessionContext State Holder', () => {
    it('should initialize empty player assignments and unlocked status', () => {
        const context = new SessionContext();
        const room = context.lobbyManager.getOrCreateRoom('default');
        expect(room.matchStarted).toBe(false);
        expect(room.lockedIn.player1).toBe(false);
        expect(room.playerAssignments.player1).toBeNull();
    });
});

