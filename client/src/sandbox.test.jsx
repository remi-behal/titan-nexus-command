import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('./hooks/useGameSocket', () => {
    return {
        socket: {
            id: 'mock-socket-id',
            emit: vi.fn(),
            on: vi.fn(),
            off: vi.fn()
        },
        useGameSocket: () => ({
            isConnected: true,
            myPlayerId: null,
            playerState: null,
            lobbyStatus: {
                slots: [null, null],
                selectedMapName: null
            },
            matchStarted: false,
            syncStatus: { lockedIn: { player1: false, player2: false } },
            timeRemaining: 30,
            isResolving: false,
            chatMessages: [],
            isChatOpen: false,
            unreadCount: 0,
            availableMaps: [],
            lastError: null,
            committedActions: [],
            setCommittedActions: vi.fn(),
            setLastError: vi.fn(),
            setMatchStarted: vi.fn(),
            setIsChatOpen: vi.fn(),
            setUnreadCount: vi.fn(),
            handleSendMessage: vi.fn(),
            handleToggleChat: vi.fn(),
            handleExecuteTurn: vi.fn(),
            handleClearActions: vi.fn(),
            handleRestart: vi.fn(),
            handleClaimSeat: vi.fn(),
            handleReadyToggle: vi.fn(),
            handleSetMap: vi.fn(),
            handleMapSave: vi.fn()
        })
    };
});

import App from './App.jsx';

describe('App Practice Range Sandbox Integration', () => {
    it('enters practice range and displays the sandbox interface', () => {
        render(<App />);
        const sandboxBtn = screen.getByText('PRACTICE RANGE');
        expect(sandboxBtn).toBeDefined();
        
        fireEvent.click(sandboxBtn);
        expect(screen.getByText(/PRACTICE RANGE \| ACTIVE PILOT/i)).toBeDefined();
    });
});
