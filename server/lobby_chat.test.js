import { describe, it, expect } from 'vitest';
import { LobbyRoom } from './LobbyRoom.js';

describe('LobbyRoom Chat State', () => {
    it('should initialize empty and cap history at 50 messages with truncation', () => {
        const room = new LobbyRoom('test-room');
        expect(room.chatHistory).toEqual([]);

        // Verify truncation
        const longText = 'a'.repeat(250);
        const msg = room.addMessage('p1', 'Player 1', longText);
        expect(msg.text).toHaveLength(200);
        expect(msg.senderName).toBe('Player 1');
        expect(msg.id).toBeDefined();
        expect(msg.timestamp).toBeLessThanOrEqual(Date.now());

        // Verify roll-over limit of 50
        for (let i = 0; i < 60; i++) {
            room.addMessage('p1', 'Player 1', `msg ${i}`);
        }
        expect(room.chatHistory.length).toBe(50);
        expect(room.chatHistory[0].text).toBe('msg 10');
    });
});
