import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SidebarLeft from './SidebarLeft';
import { audioManager } from '../../utils/AudioManager';

vi.mock('../../utils/AudioManager', () => ({
    audioManager: {
        subscribe: vi.fn(() => () => {}),
        playMusic: vi.fn(),
        setVolume: vi.fn(),
        toggleMute: vi.fn(),
        pauseMusic: vi.fn(),
        resumeMusic: vi.fn(),
        nextTrack: vi.fn(),
        prevTrack: vi.fn(),
        toggleShuffle: vi.fn(),
        isPlaying: false,
        isMuted: false,
        volume: 0.5,
        shuffle: false
    },
    TRACKS: [{ id: 'twimble', name: 'Twimble', path: '/audio/tracks/twimble.mod' }]
}));

describe('SidebarLeft', () => {
    it('renders player info and handles mute action internally', () => {
        const pCurrent = { color: '#00ff44', energy: 100 };
        render(
            <SidebarLeft
                myPlayerId="player1"
                pCurrent={pCurrent}
                playerState={{ turn: 1 }}
                isSpectator={false}
                selectedHubId={null}
            />
        );
        const muteButton = screen.getByTitle('Mute Audio');
        fireEvent.click(muteButton);
        expect(audioManager.toggleMute).toHaveBeenCalled();
    });
});
