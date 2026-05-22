import { zzfx, setZzfxContext } from './ZzFX';

class AudioManager {
    constructor() {
        this.ctx = null;
        this.player = null;
        this.currentTrack = null;
        this.volume = 0.5;
        this.isMuted = false;
        this.isPlaying = false;
    }

    init() {
        if (this.initPromise) return this.initPromise;

        this.initPromise = new Promise(async (resolve, reject) => {
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                this.ctx = new AudioCtx();
                setZzfxContext(this.ctx);
                
                // Dynamic import of chiptune3 only in browser context
                const { ChiptuneJsPlayer } = await import('chiptune3/chiptune3.js');
                this.player = new ChiptuneJsPlayer({
                    context: this.ctx,
                    repeatCount: -1
                });
                
                // Explicitly connect gain node output to context destination
                this.player.gain.connect(this.ctx.destination);
                
                // Wait for worklet module to load and compile before resolving
                this.player.onInitialized(() => {
                    this.player.setVol(this.volume);
                    resolve();
                });
            } catch (e) {
                console.error('AudioManager initialization failed:', e);
                this.initPromise = null;
                reject(e);
            }
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

        if (this.player && trackPath) {
            this.player.load(trackPath);
            this.player.setVol(this.isMuted ? 0 : this.volume);
        }
    }

    stopMusic() {
        this.isPlaying = false;
        if (this.player) {
            try {
                this.player.stop();
            } catch (e) {
                // Ignore silent stop failures
            }
        }
    }

    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
        if (this.player) {
            this.player.setVol(this.isMuted ? 0 : this.volume);
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.player) {
            this.player.setVol(this.isMuted ? 0 : this.volume);
        }
    }

    playSfx(params) {
        if (this.isMuted) return;
        this.init().then(() => {
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            // Inject global volume multiplier into first index
            const finalParams = [...params];
            finalParams[0] = (finalParams[0] === undefined ? 1 : finalParams[0]) * this.volume;
            zzfx(...finalParams);
        }).catch((err) => {
            console.error('Failed playing SFX:', err);
        });
    }

    playRoundStart() {
        // High fidelity retro ping/chime sound array for Round Start
        const roundStartParams = [0.5, , 150, .4, .1, .2, 1, 1.5, , , , , , , , , .1, .8, .1];
        this.playSfx(roundStartParams);
    }
}

export const audioManager = new AudioManager();
