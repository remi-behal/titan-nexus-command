import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatPanel from './ChatPanel.jsx';

describe('ChatPanel Component', () => {
    it('should render message list and trigger onSendMessage', () => {
        const mockSend = vi.fn();
        const messages = [
            {
                id: '1',
                senderId: 'player1',
                senderName: 'Player 1',
                text: 'Hi',
                timestamp: Date.now()
            }
        ];

        render(
            <ChatPanel
                messages={messages}
                onSendMessage={mockSend}
                isOpen={true}
                onToggle={() => {}}
                unreadCount={0}
            />
        );

        expect(screen.getByText('Player 1:')).toBeDefined();
        expect(screen.getByText('Hi')).toBeDefined();

        const input = screen.getByPlaceholderText('Type a message...');
        fireEvent.change(input, { target: { value: 'Hello back' } });

        const sendBtn = screen.getByText('Send');
        fireEvent.click(sendBtn);

        expect(mockSend).toHaveBeenCalledWith('Hello back');
    });
});
