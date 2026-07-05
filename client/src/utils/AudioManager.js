import { zzfx, setZzfxContext } from './ZzFX';
import zzfxSounds from './zzfx_sounds.json';

export const MAX_FALLOFF_DISTANCE = 800;
export const MIN_FLOOR = 0.05;

export const TRACKS = [
    { id: 'twimble', name: 'TWIMBLE.MOD', path: '/audio/tracks/twimble.mod' },
    { id: 'banana', name: 'BANANA.XM', path: '/audio/tracks/hackurr_-_banana.xm' },
    { id: 'entrance', name: 'ENTRANCE.MOD', path: '/audio/tracks/_entrance_.mod' },
    { id: 'motional', name: 'ROZ - MOTIONAL.XM', path: '/audio/tracks/roz_-_motional.xm' },
    { id: 'showstopper', name: 'SHOWSTOPPER.MOD', path: '/audio/tracks/showstopper.mod' }
];

class AudioManager {
    constructor() {
        this.ctx = null;
        this.player = null;
        this.currentTrack = null;
        this.volume = 0.5;
        this.isMuted = false;
        this.isPlaying = false;
        this.isPaused = false;
        this.shuffle = false;
        this.listeners = [];
        this.compressor = null;
        this.frameSounds = new Set();
        this.cameraContext = null;

        this.registerJsonSounds();
        this.setupUnlockListeners();
    }

    setupUnlockListeners() {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return;
        }

        const unlock = async () => {
            try {
                if (!this.ctx) {
                    await this.init();
                }
                if (this.ctx && this.ctx.state === 'suspended') {
                    await this.ctx.resume();
                }
                if (this.ctx && this.ctx.state === 'running') {
                    removeListeners();
                }
            } catch (e) {
                console.error('Failed to unlock AudioContext:', e);
            }
        };

        const removeListeners = () => {
            document.removeEventListener('click', unlock, true);
            document.removeEventListener('touchstart', unlock, true);
        };

        document.addEventListener('click', unlock, true);
        document.addEventListener('touchstart', unlock, true);
    }

    updateCameraContext(cameraOffset, zoom, canvasW, canvasH, mapW, mapH) {
        this.cameraContext = { cameraOffset, zoom, canvasW, canvasH, mapW, mapH };
    }

    calculateSpatialVolume(soundX, soundY) {
        if (!this.cameraContext || soundX === undefined || soundY === undefined) {
            return 1.0;
        }

        const { cameraOffset, zoom, canvasW, canvasH, mapW, mapH } = this.cameraContext;

        const viewportWidth = canvasW / zoom;
        const viewportHeight = canvasH / zoom;

        const cx = cameraOffset.x + viewportWidth / 2;
        const cy = cameraOffset.y + viewportHeight / 2;

        let dx = soundX - cx;
        let dy = soundY - cy;
        if (dx > mapW / 2) dx -= mapW;
        if (dx < -mapW / 2) dx += mapW;
        if (dy > mapH / 2) dy -= mapH;
        if (dy < -mapH / 2) dy += mapH;

        const inViewport = Math.abs(dx) <= viewportWidth / 2 && Math.abs(dy) <= viewportHeight / 2;
        if (inViewport) {
            return 1.0;
        }

        const distX = Math.max(0, Math.abs(dx) - viewportWidth / 2);
        const distY = Math.max(0, Math.abs(dy) - viewportHeight / 2);
        const distFromEdge = Math.sqrt(distX * distX + distY * distY);

        const falloffFactor = Math.max(0, 1 - distFromEdge / MAX_FALLOFF_DISTANCE);
        return MIN_FLOOR + (1.0 - MIN_FLOOR) * falloffFactor;
    }

    subscribe(listener) {
        this.listeners.push(listener);
        // Instantly notify current state on subscription
        listener({
            currentTrack: this.currentTrack,
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            isMuted: this.isMuted,
            volume: this.volume,
            shuffle: this.shuffle
        });
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
        };
    }

    notify() {
        this.listeners.forEach((l) =>
            l({
                currentTrack: this.currentTrack,
                isPlaying: this.isPlaying,
                isPaused: this.isPaused,
                isMuted: this.isMuted,
                volume: this.volume,
                shuffle: this.shuffle
            })
        );
    }

    init() {
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();

            // Create DynamicsCompressor to prevent digital clipping
            this.compressor = this.ctx.createDynamicsCompressor();
            this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
            this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
            this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
            this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
            this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);
            this.compressor.connect(this.ctx.destination);

            setZzfxContext(this.ctx, this.compressor);

            // Dynamic import of chiptune3 only in browser context
            const { ChiptuneJsPlayer } = await import('chiptune3/chiptune3.js');
            this.player = new ChiptuneJsPlayer({
                context: this.ctx,
                repeatCount: 0
            });

            // Explicitly connect gain node output to context destination
            this.player.gain.connect(this.ctx.destination);

            // Register ended event to auto play the next track
            this.player.onEnded(() => {
                this.nextTrack();
            });

            // Wait for worklet module to load and compile before resolving
            return new Promise((resolve) => {
                this.player.onInitialized(() => {
                    this.player.setVol(this.volume);
                    resolve();
                });
            });
        })().catch((e) => {
            console.error('AudioManager initialization failed:', e);
            this.initPromise = null;
            throw e;
        });

        return this.initPromise;
    }

    async playMusic(trackPath) {
        await this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        if (this.currentTrack === trackPath && this.isPlaying) {
            return;
        }

        this.stopMusic();
        this.currentTrack = trackPath;
        this.isPlaying = true;
        this.isPaused = false;

        if (this.player && trackPath) {
            this.player.load(trackPath);
            this.player.setVol(this.isMuted ? 0 : this.volume);
        }
        this.notify();
    }

    stopMusic() {
        this.isPlaying = false;
        this.isPaused = false;
        if (this.player) {
            try {
                this.player.stop();
            } catch {
                // Ignore silent stop failures
            }
        }
        this.notify();
    }

    pauseMusic() {
        if (this.player && this.isPlaying) {
            this.player.pause();
            this.isPaused = true;
            this.isPlaying = false;
            this.notify();
        }
    }

    resumeMusic() {
        if (this.player && this.isPaused) {
            this.player.unpause();
            this.isPaused = false;
            this.isPlaying = true;
            this.notify();
        } else if (this.currentTrack) {
            this.playMusic(this.currentTrack);
        } else {
            this.playMusic(TRACKS[0].path);
        }
    }

    async nextTrack() {
        let nextIndex;
        if (this.shuffle) {
            nextIndex = Math.floor(Math.random() * TRACKS.length);
        } else {
            const currentIndex = TRACKS.findIndex((t) => t.path === this.currentTrack);
            nextIndex = (currentIndex + 1) % TRACKS.length;
        }
        const track = TRACKS[nextIndex];
        await this.playMusic(track.path);
        return track.path;
    }

    async prevTrack() {
        let prevIndex;
        if (this.shuffle) {
            prevIndex = Math.floor(Math.random() * TRACKS.length);
        } else {
            const currentIndex = TRACKS.findIndex((t) => t.path === this.currentTrack);
            prevIndex = (currentIndex - 1 + TRACKS.length) % TRACKS.length;
        }
        const track = TRACKS[prevIndex];
        await this.playMusic(track.path);
        return track.path;
    }

    toggleShuffle() {
        this.shuffle = !this.shuffle;
        this.notify();
        return this.shuffle;
    }

    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
        if (this.player) {
            this.player.setVol(this.isMuted ? 0 : this.volume);
        }
        this.notify();
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.player) {
            this.player.setVol(this.isMuted ? 0 : this.volume);
        }
        this.notify();
    }

    playSfx(params, soundX, soundY) {
        if (this.isMuted) return null;

        // Sound Coalescing: coalesce identical sounds triggered synchronously
        const soundKey = params.join(',');
        if (this.frameSounds.has(soundKey)) {
            return Promise.resolve(null);
        }
        this.frameSounds.add(soundKey);
        if (this.frameSounds.size === 1) {
            setTimeout(() => {
                this.frameSounds.clear();
            }, 0);
        }

        return this.init()
            .then(() => {
                if (this.ctx && this.ctx.state === 'suspended') {
                    this.ctx.resume();
                }
                // Compute spatial volume multiplier
                const spatialMultiplier = this.calculateSpatialVolume(soundX, soundY);

                // Inject global volume multiplier and spatial multiplier into first index
                const finalParams = [...params];
                finalParams[0] =
                    (finalParams[0] === undefined ? 1 : finalParams[0]) *
                    this.volume *
                    spatialMultiplier;
                return zzfx(...finalParams);
            })
            .catch((err) => {
                console.error('Failed playing SFX:', err);
                return null;
            });
    }

    /** t[0] = volume
        t[1] = randomness (typically left undefined in AudioManager)
        t[2] = frequency
        t[3] = attack
        t[4] = sustain
        t[5] = release
        t[6] = shape
        t[7] = shapeCurve
        t[8] = slide
        t[9] = deltaSlide
        t[10] = pitchJump
        t[11] = pitchJumpTime
        t[12] = repeatTime
        t[13] = noise
        t[14] = modulation
        t[15] = bitCrush
        t[16] = delay
        t[17] = sustainVolume
        t[18] = decay
        t[19] = tremolo
        t[20] = filter */

    registerJsonSounds() {
        if (!zzfxSounds || !zzfxSounds.sounds) return;

        zzfxSounds.sounds.forEach((sound) => {
            const nameWords = sound.name
                .replace(/[^a-zA-Z0-9\s]/g, '')
                .trim()
                .split(/\s+/);
            const camelCaseName = nameWords
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join('');
            const methodName = 'play' + camelCaseName;

            const params = [
                sound.volume,
                sound.randomness,
                sound.frequency,
                sound.attack,
                sound.sustain,
                sound.release,
                parseInt(sound.shape) || 0,
                sound.shapeCurve,
                sound.slide,
                sound.deltaSlide,
                sound.pitchJump,
                sound.pitchJumpTime,
                sound.repeatTime,
                sound.noise,
                sound.modulation,
                sound.bitCrush,
                sound.delay,
                sound.sustainVolume,
                sound.decay,
                sound.tremolo,
                sound.filter
            ];

            this[methodName] = (x, y) => this.playSfx(params, x, y);
        });
    }

    getRegisteredSounds() {
        if (!zzfxSounds || !zzfxSounds.sounds) return [];
        return zzfxSounds.sounds.map((sound) => {
            const nameWords = sound.name
                .replace(/[^a-zA-Z0-9\s]/g, '')
                .trim()
                .split(/\s+/);
            const camelCaseName = nameWords
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join('');
            const methodName = 'play' + camelCaseName;
            return {
                name: sound.name,
                methodName,
                favorite: sound.favorite || false
            };
        });
    }
    // Inside AudioManager class
    async playHeavyErrorCombo() {
        // Plays both sounds in parallel and returns their sources in an array
        const sources = await Promise.all([this.playHeavyLaunch(), this.playLongError()]);
        return sources; // Can be routed or handled together
    }
}

export const audioManager = new AudioManager();
