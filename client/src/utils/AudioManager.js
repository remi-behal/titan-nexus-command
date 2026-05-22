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

    playShoot() {
        // Snappy pitch-sliding blip for standard projectiles
        this.playSfx([0.2, , 400, .05, , .1, , , 50, -500]);
    }

    playHeavyLaunch() {
        // Deep rocket rumble/thrust for Homing Missiles and Nukes
        this.playSfx([0.4, , 80, .1, .2, .3, , 1.5, , -5]);
    }

    playLaser() {
        // Rapid, high-pitched clean chirp for Laser Point Defense
        this.playSfx([0.15, , 1200, .01, .05, .05, , , , -20]);
    }

    playExplosion() {
        // Classic white-noise crunchy explosion for normal weapon impacts
        this.playSfx([0.35, , 100, .05, .1, .3, , 2.5, , , , , , , , , .2, .5]);
    }

    playShieldHit() {
        // Metallic "ping/deflect" sound when shield takes damage or spark occurs
        this.playSfx([0.25, , 800, .02, , .08, 1, , , , , , , 200, .02]);
    }

    playNukeDetonation() {
        // Massive, earth-shaking low-frequency sweep with long release
        this.playSfx([0.65, , 45, .2, .4, 1.2, , 3.8, , -1, , , , , , , .3, .2, .5]);
    }

    playLinkSevered() {
        // Snappy descending energy snap when connection is severed
        this.playSfx([0.25, , 600, .01, , .15, , 1.2, , -30, 200]);
    }

    playStructureDestroyed() {
        // Descending breakdown chime when a structure collapses
        this.playSfx([0.35, , 120, .05, .15, .4, , 1.8, , -8]);
    }
}

export const audioManager = new AudioManager();
