// server/lobby.test.js
import { describe, it, expect } from 'vitest';
import { LobbyRoom } from './LobbyRoom.js';

describe('LobbyRoom', () => {
    it('should allow claiming a seat', () => {
        const room = new LobbyRoom('test-room', 2);
        const result = room.claimSeat(0, 'token-1', 'socket-1');
        expect(result.success).toBe(true);
        expect(room.slots[0].token).toBe('token-1');
    });

    it('should toggle ready status', () => {
        const room = new LobbyRoom('test-room', 2);
        room.claimSeat(0, 'token-1', 'socket-1');
        room.toggleReady('socket-1', true);
        expect(room.slots[0].ready).toBe(true);
    });

    it('should vacate seat on disconnect', () => {
        const room = new LobbyRoom('test-room', 2);
        room.claimSeat(0, 'token-1', 'socket-1');
        room.handleDisconnect('socket-1');
        expect(room.slots[0]).toBeNull();
    });
});
