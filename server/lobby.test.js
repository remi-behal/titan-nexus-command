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

    it('should set team for a seat with size limit enforcement', () => {
        const room = new LobbyRoom('test-room', 8);
        room.claimSeat(0, 'token-1', 'socket-1');
        room.claimSeat(1, 'token-2', 'socket-2');
        
        // Assert defaults
        expect(room.slots[0].team).toBe('Team A');
        expect(room.slots[1].team).toBe('Team A');

        // Set team successfully
        const ok = room.setTeam('socket-1', 'Team B', 2);
        expect(ok).toBe(true);
        expect(room.slots[0].team).toBe('Team B');

        // Over-limit set should fail
        room.claimSeat(2, 'token-3', 'socket-3');
        room.setTeam('socket-2', 'Team B', 2); // Now Team B has 2 players
        
        const overLimit = room.setTeam('socket-3', 'Team B', 2);
        expect(overLimit).toBe(false);
    });
});

