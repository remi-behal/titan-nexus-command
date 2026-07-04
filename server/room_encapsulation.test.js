import { describe, it, expect } from 'vitest';
import { LobbyRoom } from './LobbyRoom.js';
import { SessionContext } from './context/SessionContext.js';

describe('LobbyRoom Encapsulation', () => {
    it('should have separate game states and timer services per room', () => {
        const context = new SessionContext();
        const roomA = new LobbyRoom('roomA', 8, context);
        const roomB = new LobbyRoom('roomB', 8, context);
        
        expect(roomA.game).toBeDefined();
        expect(roomB.game).toBeDefined();
        expect(roomA.game).not.toBe(roomB.game);
        expect(roomA.timerService).not.toBe(roomB.timerService);
    });
});
