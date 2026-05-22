import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audioManager } from './AudioManager';
import * as ZzFXModule from './ZzFX';

vi.mock('chiptune3/chiptune3.js', () => {
    class MockPlayer {
        constructor() {
            this.gain = {
                connect: vi.fn()
            };
        }
        setVol() {}
        load() {}
        play() {}
        stop() {}
        onInitialized(callback) {
            callback();
        }
    }
    return { ChiptuneJsPlayer: MockPlayer };
});

describe('AudioManager', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        // Reset properties
        audioManager.ctx = null;
        audioManager.player = null;
        audioManager.initPromise = null;
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

        await audioManager.init();
        audioManager.playRoundStart();
        
        // Wait for microtasks to resolve
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(zzfxSpy).toHaveBeenCalled();
    });

    it('verifies all procedural sound playback methods', async () => {
        const mockContext = {
            state: 'running',
            resume: vi.fn().mockResolvedValue()
        };
        vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => mockContext));
        const zzfxSpy = vi.spyOn(ZzFXModule, 'zzfx').mockReturnValue(null);

        await audioManager.init();

        const methods = [
            'playShoot',
            'playHeavyLaunch',
            'playLaser',
            'playExplosion',
            'playShieldHit',
            'playNukeDetonation',
            'playLinkSevered',
            'playStructureDestroyed'
        ];

        for (const method of methods) {
            audioManager[method]();
            // Wait for microtasks to resolve
            await new Promise(resolve => setTimeout(resolve, 1));
            expect(zzfxSpy).toHaveBeenCalled();
            zzfxSpy.mockClear();
        }
    });

    it('verifies new interactive and planning sound playback methods', async () => {
        const mockContext = {
            state: 'running',
            resume: vi.fn().mockResolvedValue()
        };
        vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => mockContext));
        const zzfxSpy = vi.spyOn(ZzFXModule, 'zzfx').mockReturnValue(null);

        await audioManager.init();

        const methods = [
            'playClick',
            'playSeatClaim',
            'playUplink',
            'playTerminalSelect',
            'playLinkStage',
            'playActionReset',
            'playStructureLanding'
        ];

        for (const method of methods) {
            audioManager[method]();
            // Wait for microtasks to resolve
            await new Promise(resolve => setTimeout(resolve, 1));
            expect(zzfxSpy).toHaveBeenCalled();
            zzfxSpy.mockClear();
        }
    });
});

