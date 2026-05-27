import { describe, it, expect } from 'vitest';
import { SessionContext } from './SessionContext.js';

describe('SessionContext State Holder', () => {
    it('should initialize empty player assignments and unlocked status', () => {
        const context = new SessionContext();
        expect(context.matchStarted).toBe(false);
        expect(context.lockedIn.player1).toBe(false);
        expect(context.playerAssignments.player1).toBeNull();
    });
});
