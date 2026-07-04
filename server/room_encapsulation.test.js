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

import { SessionContext } from './context/SessionContext.js';

describe('LobbyManager Room Listings', () => {
    it('should list rooms and locate room by socket id', () => {
        const context = new SessionContext();
        const manager = context.lobbyManager;
        const room = manager.getOrCreateRoom('room-test');
        room.slots[0] = { socketId: 'socket-123', token: 'token-abc' };
        
        expect(manager.getRoomList().length).toBeGreaterThan(0);
        expect(manager.findRoomBySocketId('socket-123')).toBe(room);
    });
});

