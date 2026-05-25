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
        const roundStartParams = [0.5, undefined, 150, .4, .1, .2, 1, 1.5, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, .1, .8, .1];
        this.playSfx(roundStartParams);
    }

    playShoot() {
        // Snappy pitch-sliding blip for standard projectiles
        this.playSfx([0.2, undefined, 400, .05, undefined, .1, undefined, undefined, 50, -500]);
    }

    playHeavyLaunch() {
        // Deep rocket rumble/thrust for Homing Missiles and Nukes
        this.playSfx([0.4, undefined, 80, .1, .2, .3, undefined, 1.5, undefined, -5]);
    }

    playLaser() {
        // Rapid, high-pitched clean chirp for Laser Point Defense
        this.playSfx([0.15, undefined, 1200, .01, .05, .05, undefined, undefined, undefined, -20]);
    }

    playExplosion() {
        // Classic white-noise crunchy explosion for normal weapon impacts
        this.playSfx([0.35, undefined, 100, .05, .1, .3, undefined, 2.5, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, .2, .5]);
    }

    playShieldHit() {
        // Metallic "ping/deflect" sound when shield takes damage or spark occurs
        this.playSfx([0.25, undefined, 800, .02, undefined, .08, 1, undefined, undefined, undefined, undefined, undefined, undefined, 200, .02]);
    }

    playNukeDetonation() {
        // Massive, earth-shaking low-frequency sweep with long release
        this.playSfx([0.65, undefined, 45, .2, .4, 1.2, undefined, 3.8, undefined, -1, undefined, undefined, undefined, undefined, undefined, undefined, .3, .2, .5]);
    }

    playLinkSevered() {
        // Snappy descending energy snap when connection is severed
        this.playSfx([0.25, undefined, 600, .01, undefined, .15, undefined, 1.2, undefined, -30, 200]);
    }

    playStructureDestroyed() {
        // Descending breakdown chime when a structure collapses
        this.playSfx([0.35, undefined, 120, .05, .15, .4, undefined, 1.8, undefined, -8]);
    }

    playClick() {
        // Short high-pass pop for menu clicks
        this.playSfx([0.1, undefined, 1000, .01, undefined, .04, 1, undefined, undefined, undefined, undefined, undefined, undefined, 100, .05]);
    }

    playSeatClaim() {
        // Mechanical lock-in sound for joining seats
        this.playSfx([0.3, undefined, 200, .05, .05, .15, 1, .8, undefined, undefined, undefined, undefined, undefined, 300, .02]);
    }

    playUplink() {
        // Telemetry sweep for turn submission
        this.playSfx([0.25, undefined, 300, .08, .1, .2, 1, 1.2, undefined, 25]);
    }

    playTerminalSelect() {
        // Rapid terminal scan chirp for selecting outposts
        this.playSfx([0.12, undefined, 600, .01, .03, .05, undefined, undefined, undefined, 15]);
    }

    playLinkStage() {
        // Cyber stretching ping for link staging
        this.playSfx([0.18, undefined, 350, .03, .05, .06, undefined, 0.5, undefined, 5]);
    }

    playActionReset() {
        // Low-frequency buzz when clearing actions
        this.playSfx([0.2, undefined, 150, .02, .05, .12, undefined, undefined, undefined, -15]);
    }

    playStructureLanding() {
        // Pneumatic hydraulic impact slam when structures land
        this.playSfx([0.55, undefined, 65, .08, .12, .35, undefined, 2.2, undefined, -3]);
    }

    playSamLaunch() {
        // Pneumatic eject noise pop + rising frequency sweep whistle
        this.playSfx([0.35, undefined, 180, 0.05, 0.05, 0.2, undefined, 1.2, undefined, 10, undefined, undefined, undefined, 200, 0.02]);
    }

    playSamFlight() {
        // Soft low-frequency rocket engine thruster rumble
        this.playSfx([0.08, undefined, 75, 0.04, undefined, 0.08, undefined, 0.5, undefined, -15]);
    }

    playSamLockOn() {
        // Snappy high-frequency dual-tone cybernetic lock alarm chime
        this.playSfx([0.22, undefined, 950, 0.01, 0.03, 0.08, 1, 1.8, undefined, 10, 300, 0.02, 0.05]);
    }
}

export const audioManager = new AudioManager();
