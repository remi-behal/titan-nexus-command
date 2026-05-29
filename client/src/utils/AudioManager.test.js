import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audioManager, TRACKS } from './AudioManager';
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
        pause() {}
        unpause() {}
        togglePause() {}
        onInitialized(callback) {
            callback();
        }
        onEnded(callback) {
            this.endedCallback = callback;
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
        audioManager.shuffle = false;
        audioManager.listeners = [];
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
            'playStructureLanding',
            'playSamLaunch',
            'playSamFlight',
            'playSamLockOn'
        ];

        for (const method of methods) {
            audioManager[method]();
            // Wait for microtasks to resolve
            await new Promise(resolve => setTimeout(resolve, 1));
            expect(zzfxSpy).toHaveBeenCalled();
            zzfxSpy.mockClear();
        }
    });

    it('verifies exact ZzFX parameters for SAM missile audio features', async () => {
        const mockContext = {
            state: 'running',
            resume: vi.fn().mockResolvedValue()
        };
        vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => mockContext));
        const zzfxSpy = vi.spyOn(ZzFXModule, 'zzfx').mockReturnValue(null);

        await audioManager.init();

        // 1. Launch
        audioManager.playSamLaunch();
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(zzfxSpy).toHaveBeenLastCalledWith(
            0.175, undefined, 180, 0.05, 0.05, 0.2, undefined, 1.2, undefined, 10, undefined, undefined, undefined, 200, 0.02
        );

        // 2. Flight
        audioManager.playSamFlight();
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(zzfxSpy).toHaveBeenLastCalledWith(
            0.04, undefined, 75, 0.04, undefined, 0.08, undefined, 0.5, undefined, -15
        );

        // 3. Lock On
        audioManager.playSamLockOn();
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(zzfxSpy).toHaveBeenLastCalledWith(
            0.11, undefined, 950, 0.01, 0.03, 0.08, 1, 1.8, undefined, 10, 300, 0.02, 0.05
        );
    });

    it('defines and exports a valid TRACKS playlist', () => {
        expect(TRACKS).toBeDefined();
        expect(TRACKS.length).toBe(5);
        expect(TRACKS[0].id).toBe('twimble');
        expect(TRACKS[1].id).toBe('banana');
        expect(TRACKS[2].id).toBe('entrance');
        expect(TRACKS[3].id).toBe('motional');
        expect(TRACKS[4].id).toBe('showstopper');
    });

    it('plays different tracks from the playlist via playMusic', async () => {
        const mockContext = {
            state: 'running',
            resume: vi.fn().mockResolvedValue()
        };
        vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => mockContext));

        await audioManager.init();
        const loadSpy = vi.spyOn(audioManager.player, 'load');

        await audioManager.playMusic('/audio/tracks/twimble.mod');
        expect(loadSpy).toHaveBeenCalledWith('/audio/tracks/twimble.mod');
        expect(audioManager.currentTrack).toBe('/audio/tracks/twimble.mod');

        await audioManager.playMusic('/audio/tracks/hackurr_-_banana.xm');
        expect(loadSpy).toHaveBeenLastCalledWith('/audio/tracks/hackurr_-_banana.xm');
    });

    it('handles pause and resume correctly', async () => {
        const mockContext = {
            state: 'running',
            resume: vi.fn().mockResolvedValue()
        };
        vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => mockContext));

        await audioManager.init();
        const pauseSpy = vi.spyOn(audioManager.player, 'pause');
        const unpauseSpy = vi.spyOn(audioManager.player, 'unpause');

        audioManager.isPlaying = true;
        audioManager.pauseMusic();
        expect(pauseSpy).toHaveBeenCalled();
        expect(audioManager.isPaused).toBe(true);
        expect(audioManager.isPlaying).toBe(false);

        audioManager.resumeMusic();
        expect(unpauseSpy).toHaveBeenCalled();
        expect(audioManager.isPaused).toBe(false);
        expect(audioManager.isPlaying).toBe(true);
    });

    it('handles next, previous, and shuffle toggling', async () => {
        const mockContext = {
            state: 'running',
            resume: vi.fn().mockResolvedValue()
        };
        vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => mockContext));

        await audioManager.init();
        
        audioManager.shuffle = false;
        audioManager.currentTrack = TRACKS[0].path;

        const nextTrack = await audioManager.nextTrack();
        expect(nextTrack).toBe(TRACKS[1].path);

        const prevTrack = await audioManager.prevTrack();
        expect(prevTrack).toBe(TRACKS[0].path);

        audioManager.toggleShuffle();
        expect(audioManager.shuffle).toBe(true);
    });

    it('automatically plays the next track when the current one ends', async () => {
        const mockContext = {
            state: 'running',
            resume: vi.fn().mockResolvedValue()
        };
        vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => mockContext));

        await audioManager.init();
        audioManager.currentTrack = TRACKS[0].path;
        audioManager.isPlaying = true;

        // Trigger the end of the song
        await audioManager.player.endedCallback();

        // It should automatically advance to index 1 (banana)
        expect(audioManager.currentTrack).toBe(TRACKS[1].path);
        expect(audioManager.isPlaying).toBe(true);
    });

    it('notifies subscribers of state changes', async () => {
        const mockContext = {
            state: 'running',
            resume: vi.fn().mockResolvedValue()
        };
        vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => mockContext));

        await audioManager.init();

        const stateChanges = [];
        const unsubscribe = audioManager.subscribe((state) => {
            stateChanges.push({ ...state });
        });

        // Initial subscription notification
        expect(stateChanges.length).toBe(1);

        // Change state
        audioManager.toggleShuffle();

        expect(stateChanges.length).toBe(2);
        expect(stateChanges[1].shuffle).toBe(true);

        unsubscribe();
    });
});

