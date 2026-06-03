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
        audioManager.frameSounds = new Set();
    });

    it('initializes context and player successfully', async () => {
        const mockCompressor = {
            threshold: { setValueAtTime: vi.fn() },
            knee: { setValueAtTime: vi.fn() },
            ratio: { setValueAtTime: vi.fn() },
            attack: { setValueAtTime: vi.fn() },
            release: { setValueAtTime: vi.fn() },
            connect: vi.fn()
        };
        const mockContext = {
            state: 'running',
            currentTime: 0,
            resume: vi.fn().mockResolvedValue(),
            createDynamicsCompressor: vi.fn().mockReturnValue(mockCompressor),
            destination: {}
        };
        vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => mockContext));

        await audioManager.init();
        expect(audioManager.ctx).toBe(mockContext);
        expect(audioManager.player).toBeDefined();
    });

    it('plays round start sound effect using ZzFX', async () => {
        const mockCompressor = {
            threshold: { setValueAtTime: vi.fn() },
            knee: { setValueAtTime: vi.fn() },
            ratio: { setValueAtTime: vi.fn() },
            attack: { setValueAtTime: vi.fn() },
            release: { setValueAtTime: vi.fn() },
            connect: vi.fn()
        };
        const mockContext = {
            state: 'running',
            currentTime: 0,
            resume: vi.fn().mockResolvedValue(),
            createDynamicsCompressor: vi.fn().mockReturnValue(mockCompressor),
            destination: {}
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
        const mockCompressor = {
            threshold: { setValueAtTime: vi.fn() },
            knee: { setValueAtTime: vi.fn() },
            ratio: { setValueAtTime: vi.fn() },
            attack: { setValueAtTime: vi.fn() },
            release: { setValueAtTime: vi.fn() },
            connect: vi.fn()
        };
        const mockContext = {
            state: 'running',
            currentTime: 0,
            resume: vi.fn().mockResolvedValue(),
            createDynamicsCompressor: vi.fn().mockReturnValue(mockCompressor),
            destination: {}
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
        const mockCompressor = {
            threshold: { setValueAtTime: vi.fn() },
            knee: { setValueAtTime: vi.fn() },
            ratio: { setValueAtTime: vi.fn() },
            attack: { setValueAtTime: vi.fn() },
            release: { setValueAtTime: vi.fn() },
            connect: vi.fn()
        };
        const mockContext = {
            state: 'running',
            currentTime: 0,
            resume: vi.fn().mockResolvedValue(),
            createDynamicsCompressor: vi.fn().mockReturnValue(mockCompressor),
            destination: {}
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
        const mockCompressor = {
            threshold: { setValueAtTime: vi.fn() },
            knee: { setValueAtTime: vi.fn() },
            ratio: { setValueAtTime: vi.fn() },
            attack: { setValueAtTime: vi.fn() },
            release: { setValueAtTime: vi.fn() },
            connect: vi.fn()
        };
        const mockContext = {
            state: 'running',
            currentTime: 0,
            resume: vi.fn().mockResolvedValue(),
            createDynamicsCompressor: vi.fn().mockReturnValue(mockCompressor),
            destination: {}
        };
        vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => mockContext));
        const zzfxSpy = vi.spyOn(ZzFXModule, 'zzfx').mockReturnValue(null);

        await audioManager.init();

        // 1. Launch
        audioManager.playSamLaunch();
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(zzfxSpy).toHaveBeenLastCalledWith(
            0.5, 0.05, 528, 0.01, 0, 0.48, 0, 0.3, -9, 0, 0, 0, 0.32, 4.2, 0, 0, 0, 1, 0, 0, 0
        );

        // 2. Flight
        audioManager.playSamFlight();
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(zzfxSpy).toHaveBeenLastCalledWith(
            0.04, 0.05, 75, 0.04, 0, 0.08, 0, 0.5, 0, -15, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0
        );

        // 3. Lock On
        audioManager.playSamLockOn();
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(zzfxSpy).toHaveBeenLastCalledWith(
            0.11, 0.05, 950, 0.01, 0.03, 0.08, 1, 1.8, 0, 10, 300, 0.02, 0.05, 0, 0, 0, 0, 1, 0, 0, 0
        );
    });

    it('verifies all custom exported ZzFX sound playback methods', async () => {
        const mockCompressor = {
            threshold: { setValueAtTime: vi.fn() },
            knee: { setValueAtTime: vi.fn() },
            ratio: { setValueAtTime: vi.fn() },
            attack: { setValueAtTime: vi.fn() },
            release: { setValueAtTime: vi.fn() },
            connect: vi.fn()
        };
        const mockContext = {
            state: 'running',
            currentTime: 0,
            resume: vi.fn().mockResolvedValue(),
            createDynamicsCompressor: vi.fn().mockReturnValue(mockCompressor),
            destination: {}
        };
        vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => mockContext));
        const zzfxSpy = vi.spyOn(ZzFXModule, 'zzfx').mockReturnValue(null);

        await audioManager.init();

        const registered = audioManager.getRegisteredSounds();
        expect(registered.length).toBeGreaterThan(0);

        for (const sound of registered) {
            audioManager[sound.methodName]();
            await new Promise(resolve => setTimeout(resolve, 1));
            expect(zzfxSpy).toHaveBeenCalled();
            zzfxSpy.mockClear();
        }
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
        const mockCompressor = {
            threshold: { setValueAtTime: vi.fn() },
            knee: { setValueAtTime: vi.fn() },
            ratio: { setValueAtTime: vi.fn() },
            attack: { setValueAtTime: vi.fn() },
            release: { setValueAtTime: vi.fn() },
            connect: vi.fn()
        };
        const mockContext = {
            state: 'running',
            currentTime: 0,
            resume: vi.fn().mockResolvedValue(),
            createDynamicsCompressor: vi.fn().mockReturnValue(mockCompressor),
            destination: {}
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
        const mockCompressor = {
            threshold: { setValueAtTime: vi.fn() },
            knee: { setValueAtTime: vi.fn() },
            ratio: { setValueAtTime: vi.fn() },
            attack: { setValueAtTime: vi.fn() },
            release: { setValueAtTime: vi.fn() },
            connect: vi.fn()
        };
        const mockContext = {
            state: 'running',
            currentTime: 0,
            resume: vi.fn().mockResolvedValue(),
            createDynamicsCompressor: vi.fn().mockReturnValue(mockCompressor),
            destination: {}
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
        const mockCompressor = {
            threshold: { setValueAtTime: vi.fn() },
            knee: { setValueAtTime: vi.fn() },
            ratio: { setValueAtTime: vi.fn() },
            attack: { setValueAtTime: vi.fn() },
            release: { setValueAtTime: vi.fn() },
            connect: vi.fn()
        };
        const mockContext = {
            state: 'running',
            currentTime: 0,
            resume: vi.fn().mockResolvedValue(),
            createDynamicsCompressor: vi.fn().mockReturnValue(mockCompressor),
            destination: {}
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
        const mockCompressor = {
            threshold: { setValueAtTime: vi.fn() },
            knee: { setValueAtTime: vi.fn() },
            ratio: { setValueAtTime: vi.fn() },
            attack: { setValueAtTime: vi.fn() },
            release: { setValueAtTime: vi.fn() },
            connect: vi.fn()
        };
        const mockContext = {
            state: 'running',
            currentTime: 0,
            resume: vi.fn().mockResolvedValue(),
            createDynamicsCompressor: vi.fn().mockReturnValue(mockCompressor),
            destination: {}
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
        const mockCompressor = {
            threshold: { setValueAtTime: vi.fn() },
            knee: { setValueAtTime: vi.fn() },
            ratio: { setValueAtTime: vi.fn() },
            attack: { setValueAtTime: vi.fn() },
            release: { setValueAtTime: vi.fn() },
            connect: vi.fn()
        };
        const mockContext = {
            state: 'running',
            currentTime: 0,
            resume: vi.fn().mockResolvedValue(),
            createDynamicsCompressor: vi.fn().mockReturnValue(mockCompressor),
            destination: {}
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

    it('creates and configures dynamics compressor during initialization', async () => {
        const mockCompressor = {
            threshold: { setValueAtTime: vi.fn() },
            knee: { setValueAtTime: vi.fn() },
            ratio: { setValueAtTime: vi.fn() },
            attack: { setValueAtTime: vi.fn() },
            release: { setValueAtTime: vi.fn() },
            connect: vi.fn()
        };
        const mockContext = {
            state: 'running',
            currentTime: 0,
            resume: vi.fn().mockResolvedValue(),
            createDynamicsCompressor: vi.fn().mockReturnValue(mockCompressor),
            destination: {}
        };
        vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => mockContext));

        await audioManager.init();
        expect(mockContext.createDynamicsCompressor).toHaveBeenCalled();
        expect(audioManager.compressor).toBe(mockCompressor);
        expect(mockCompressor.connect).toHaveBeenCalledWith(mockContext.destination);
    });

    it('coalesces identical sound effects triggered synchronously', async () => {
        const mockCompressor = {
            threshold: { setValueAtTime: vi.fn() },
            knee: { setValueAtTime: vi.fn() },
            ratio: { setValueAtTime: vi.fn() },
            attack: { setValueAtTime: vi.fn() },
            release: { setValueAtTime: vi.fn() },
            connect: vi.fn()
        };
        const mockContext = {
            state: 'running',
            currentTime: 0,
            resume: vi.fn().mockResolvedValue(),
            createDynamicsCompressor: vi.fn().mockReturnValue(mockCompressor),
            destination: {}
        };
        vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => mockContext));
        const zzfxSpy = vi.spyOn(ZzFXModule, 'zzfx').mockReturnValue(null);

        await audioManager.init();
        
        // Trigger same sound multiple times synchronously
        const p1 = audioManager.playShoot();
        const p2 = audioManager.playShoot();
        const p3 = audioManager.playShoot();
        
        // Only the first one should be scheduled, others coalesce (resolve to null)
        const [, r2, r3] = await Promise.all([p1, p2, p3]);
        expect(zzfxSpy).toHaveBeenCalledTimes(1);
        expect(r2).toBeNull();
        expect(r3).toBeNull();

        zzfxSpy.mockClear();

        // Wait for the end of the tick / setTimeout to clear coalescing map
        await new Promise(resolve => setTimeout(resolve, 5));

        // Triggering again in a new tick should play successfully
        await audioManager.playShoot();
        expect(zzfxSpy).toHaveBeenCalledTimes(1);
    });

    describe('Spatial Volume calculations', () => {
        it('returns 1.0 when no camera context is registered', () => {
            expect(audioManager.calculateSpatialVolume(100, 100)).toBe(1.0);
        });

        it('returns 1.0 when sound is inside the viewport box', () => {
            audioManager.updateCameraContext(
                { x: 100, y: 100 }, // cameraOffset
                1.5,                 // zoom
                600,                // canvasWidth
                400,                // canvasHeight
                2000,               // mapWidth
                2000                // mapHeight
            );
            // viewportWidth = 600/1.5 = 400. viewportHeight = 400/1.5 = 266.6.
            // Viewport rect in game space: x in [100, 500], y in [100, 366.6]
            // Center: (300, 233.3)
            // Check sound inside viewport:
            expect(audioManager.calculateSpatialVolume(200, 200)).toBe(1.0);
        });

        it('returns 0.15 when sound is extremely far away', () => {
            audioManager.updateCameraContext(
                { x: 100, y: 100 },
                1.0,
                200,
                200,
                2000,
                2000
            );
            // viewportWidth = 200, viewportHeight = 200
            // Viewport rect: x in [100, 300], y in [100, 300]
            // Center: (200, 200)
            // Sound extremely far away (e.g. opposite side of torus map):
            expect(audioManager.calculateSpatialVolume(1200, 1200)).toBe(0.15);
        });

        it('returns between 0.15 and 1.0 when sound is just outside the viewport edge', () => {
            audioManager.updateCameraContext(
                { x: 100, y: 100 },
                1.0,
                200,
                200,
                2000,
                2000
            );
            // viewportWidth = 200, viewportHeight = 200
            // Viewport rect: x in [100, 300], y in [100, 300]
            // Center: (200, 200)
            // Sound at x = 400, y = 200 (distance from edge distX = 100, distY = 0 -> distFromEdge = 100)
            // falloffFactor = 1 - 100/1000 = 0.9
            // volumeMultiplier = 0.15 + 0.85 * 0.9 = 0.915
            expect(audioManager.calculateSpatialVolume(400, 200)).toBeCloseTo(0.915);
        });

        it('applies spatial volume multiplier to zzfx playback parameters', async () => {
            const mockCompressor = {
                threshold: { setValueAtTime: vi.fn() },
                knee: { setValueAtTime: vi.fn() },
                ratio: { setValueAtTime: vi.fn() },
                attack: { setValueAtTime: vi.fn() },
                release: { setValueAtTime: vi.fn() },
                connect: vi.fn()
            };
            const mockContext = {
                state: 'running',
                currentTime: 0,
                resume: vi.fn().mockResolvedValue(),
                createDynamicsCompressor: vi.fn().mockReturnValue(mockCompressor),
                destination: {}
            };
            vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => mockContext));
            const zzfxSpy = vi.spyOn(ZzFXModule, 'zzfx').mockReturnValue(null);

            await audioManager.init();

            // Set camera context and make the sound far away so volume multiplier is 0.15
            audioManager.updateCameraContext(
                { x: 100, y: 100 },
                1.0,
                200,
                200,
                2000,
                2000
            );

            // Default sfx volume in playShoot is 0.2. Global audioManager.volume is 0.5.
            // Far away spatial volume multiplier is 0.15.
            // Final volume = 0.2 * 0.5 * 0.15 = 0.015.
            await audioManager.playShoot(1200, 1200);
            
            // Wait for tick
            await new Promise(resolve => setTimeout(resolve, 5));

            expect(zzfxSpy).toHaveBeenCalledWith(
                expect.closeTo(0.015), // final volume parameter
                0.05, 400, .05, 0, .1, 0, 1, 50, -500, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0
            );
        });
    });
});

