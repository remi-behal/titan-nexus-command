import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audioManager } from './AudioManager';
import * as ZzFXModule from './ZzFX';

vi.mock('chiptune3/chiptune3.js', () => {
    const mockPlayer = vi.fn().mockImplementation(() => ({
        setVol: vi.fn(),
        load: vi.fn((path, success) => success('mock-buffer')),
        play: vi.fn(),
        stop: vi.fn()
    }));
    mockPlayer.Config = vi.fn();
    return { ChiptuneJsPlayer: mockPlayer };
});

describe('AudioManager', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        // Reset properties
        audioManager.ctx = null;
        audioManager.player = null;
        audioManager.currentTrack = null;
        audioManager.volume = 0.5;
        audioManager.isMuted = false;
        audioManager.isPlaying = false;
    });

    it('initializes context and player successfully', async () => {
        const mockContext = {
            state: 'running',
            resume: vi.fn().mockResolvedValue()
        };
        vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => mockContext));

        await audioManager.init();
        expect(audioManager.ctx).toBe(mockContext);
        expect(audioManager.player).toBeDefined();
    });

    it('plays round start sound effect using ZzFX', async () => {
        const mockContext = {
            state: 'running',
            resume: vi.fn().mockResolvedValue()
        };
        vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => mockContext));
        const zzfxSpy = vi.spyOn(ZzFXModule, 'zzfx').mockReturnValue(null);

        audioManager.playRoundStart();
        
        // Wait for asynchronous init chain to run
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(zzfxSpy).toHaveBeenCalled();
    });
});
