import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RoomBrowser } from './RoomBrowser';

describe('RoomBrowser', () => {
    it('renders room list correctly', () => {
        const rooms = [{ id: 'room-1', playerCount: 2, maxPlayers: 8, status: 'LOBBY' }];
        render(<RoomBrowser rooms={rooms} onCreateRoom={() => {}} onJoinRoom={() => {}} />);
        expect(screen.getByText('ROOM-1')).toBeDefined();
    });
});
