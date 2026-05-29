import { zzfx, setZzfxContext } from './ZzFX';

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
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify() {
        this.listeners.forEach(l => l({
            currentTrack: this.currentTrack,
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            isMuted: this.isMuted,
            volume: this.volume,
            shuffle: this.shuffle
        }));
    }

    init() {
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
            setZzfxContext(this.ctx);
            
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
        })().catch(e => {
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
            const currentIndex = TRACKS.findIndex(t => t.path === this.currentTrack);
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
            const currentIndex = TRACKS.findIndex(t => t.path === this.currentTrack);
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

    playSfx(params) {
        if (this.isMuted) return null;
        return this.init().then(() => {
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            // Inject global volume multiplier into first index
            const finalParams = [...params];
            finalParams[0] = (finalParams[0] === undefined ? 1 : finalParams[0]) * this.volume;
            return zzfx(...finalParams);
        }).catch((err) => {
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

    playRoundStart() {
        // High fidelity retro ping/chime sound array for Round Start
        const roundStartParams = [0.5, undefined, 150, .4, .1, .2, 1, 1.5, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, .1, .8, .1];
        return this.playSfx(roundStartParams);
    }

    playShoot() {
        // Snappy pitch-sliding blip for standard projectiles
        return this.playSfx([0.2, undefined, 400, .05, undefined, .1, undefined, undefined, 50, -500]);
    }

    playHeavyLaunch() {
        // Deep rocket rumble/thrust for Homing Missiles and Nukes
        return this.playSfx([0.4, undefined, 80, .1, .2, .3, undefined, 1.5, undefined, -5]);
    }

    playLaser() {
         // Fast, low-frequency laser sweep with metallic pitch jump and delay
        return this.playSfx([0.5, undefined, 14, .36, .5, .03, 4, 2.9, undefined, -22, 35, .18, undefined, undefined, 11, undefined, .01, .82, .08, undefined, -1334]);
    }

    playExplosion() {
        // Classic white-noise crunchy explosion for normal weapon impacts
        return this.playSfx([0.35, undefined, 100, .05, .1, .3, undefined, 2.5, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, .2, .5]);
    }

    playShieldHit() {
        // Metallic "ping/deflect" sound when shield takes damage or spark occurs
        return this.playSfx([0.25, undefined, 800, .02, undefined, .08, 1, undefined, undefined, undefined, undefined, undefined, undefined, 200, .02]);
    }

    playNukeDetonation() {
        // Massive, earth-shaking low-frequency sweep with long release
        return this.playSfx([0.65, undefined, 45, .2, .4, 1.2, undefined, 3.8, undefined, -1, undefined, undefined, undefined, undefined, undefined, undefined, .3, .2, .5]);
    }

    playLinkSevered() {
        // Snappy descending energy snap when connection is severed
        return this.playSfx([0.25, undefined, 600, .01, undefined, .15, undefined, 1.2, undefined, -30, 200]);
    }

    playStructureDestroyed() {
        // Descending breakdown chime when a structure collapses
        return this.playSfx([0.35, undefined, 120, .05, .15, .4, undefined, 1.8, undefined, -8]);
    }

    playClick() {
        // Short high-pass pop for menu clicks
        return this.playSfx([0.1, undefined, 1000, .01, undefined, .04, 1, undefined, undefined, undefined, undefined, undefined, undefined, 100, .05]);
    }

    playSeatClaim() {
        // Mechanical lock-in sound for joining seats
        return this.playSfx([0.3, undefined, 200, .05, .05, .15, 1, .8, undefined, undefined, undefined, undefined, undefined, 300, .02]);
    }

    playUplink() {
        // Telemetry sweep for turn submission
        return this.playSfx([0.25, undefined, 300, .08, .1, .2, 1, 1.2, undefined, 25]);
    }

    playTerminalSelect() {
        // Rapid terminal scan chirp for selecting outposts
        return this.playSfx([0.12, undefined, 600, .01, .03, .05, undefined, undefined, undefined, 15]);
    }

    playLinkStage() {
        // Cyber stretching ping for link staging
        return this.playSfx([0.18, undefined, 350, .03, .05, .06, undefined, 0.5, undefined, 5]);
    }

    playActionReset() {
        // Low-frequency buzz when clearing actions
        return this.playSfx([0.2, undefined, 150, .02, .05, .12, undefined, undefined, undefined, -15]);
    }

    playStructureLanding() {
        // Pneumatic hydraulic impact slam when structures land
        return this.playSfx([0.55, undefined, 65, .08, .12, .35, undefined, 2.2, undefined, -3]);
    }

    playSamLaunch() {
        // Pneumatic eject noise pop + rising frequency sweep whistle
        return this.playSfx([0.35, undefined, 180, 0.05, 0.05, 0.2, undefined, 1.2, undefined, 10, undefined, undefined, undefined, 200, 0.02]);
    }

    playSamFlight() {
        // Soft low-frequency rocket engine thruster rumble
        return this.playSfx([0.08, undefined, 75, 0.04, undefined, 0.08, undefined, 0.5, undefined, -15]);
    }

    playSamLockOn() {
        // Snappy high-frequency dual-tone cybernetic lock alarm chime
        return this.playSfx([0.22, undefined, 950, 0.01, 0.03, 0.08, 1, 1.8, undefined, 10, 300, 0.02, 0.05]);
    }

    playRibbit() {
        // ribbit
        return this.playSfx([0.8, undefined, 91, .39, .3, .01, 5, .38, undefined, -22, 39, .68, undefined, undefined, undefined, .2, undefined, .6, undefined, undefined, -1468]);
    }

    playCrackle() {
        // crackle
        return this.playSfx([2, undefined, 104, .7, .11, .003, 0, 30, undefined, 2, undefined, undefined, 10, undefined, 6, .4, undefined, .67, .2, undefined, 1]);
    }

    playBwow() {
        // bwow
        return this.playSfx([0.8, undefined, 180, .11, .24, .3, 4, 1.2, 3, undefined, undefined, undefined, undefined, .1, 242, undefined, undefined, .51, .12, undefined, -1453]);
    }

    playDrop() {
        // drop
        return this.playSfx([4.2, undefined, 697, .05, .04, .009, 1, .7, undefined, -2, -184, .04, undefined, .9, undefined, .1, .04, .6, undefined, .14, -1486]);
    }

    playPong() {
        // pong
        return this.playSfx([1, undefined, 170, .01, 0, .15, 3, .5, undefined, undefined, -123, .09, undefined, undefined, 129, undefined, undefined, .87]);
    }

    playHumm() {
        // humm
        return this.playSfx([1, undefined, 101, .43, .02, .21, 3, 2.7, undefined, undefined, undefined, undefined, undefined, undefined, 66, .2, undefined, .97]);
    }

    playError() {
        // error
        return this.playSfx([5, undefined, 10, .04, 0, .41, 4, 2.7, undefined, undefined, 102, .18, undefined, undefined, 66, undefined, .27, .53, undefined, .01, 896]);
    }

    playDeepHumm() {
        // deep humm
        return this.playSfx([1, undefined, 9, 1, .1, .4, 1, 3.6, undefined, undefined, 37, .05, undefined, undefined, 37, undefined, undefined, .82, .41, .12]);
    }

    playPowerOn() {
        // power on
        return this.playSfx([1, undefined, 9, .4, .1, .4, 1, 3.6, 1, undefined, 37, .02, undefined, undefined, 37, undefined, undefined, 1, .41, .12]);
    }

    playSmallBombDrop() {
        // small bomb drop
        return this.playSfx([2.6, undefined, 692, .29, 0, .32, 2, 1.2, undefined, undefined, -16, .05, .01, undefined, undefined, .1, undefined, .79, .15, undefined, -1455]);
    }

    playRobotBirdChirp() {
        // robot bird chirp
        return this.playSfx([4, undefined, 67, .02, .06, .03, 4, 3.2, 24, -5, undefined, undefined, .02, undefined, 377, undefined, undefined, .89]);
    }

    playCheepCheepCheep() {
        // cheep cheep cheep
        return this.playSfx([1.2, undefined, 513, 0, .09, .06, 1, 1.3, -87, 9, undefined, undefined, .13, undefined, undefined, undefined, .03, .98, .45, .02]);
    }

    playDeathRay() {
        // death ray
        return this.playSfx([1, undefined, 209, .1, .15, .22, 3, 3, 50, undefined, undefined, undefined, .05, undefined, 154, undefined, undefined, .63, .44, .13]);
    }

    playLongError() {
        // long error
        return this.playSfx([1, 0, 106, .45, .01, .02, 2, 2.7, undefined, undefined, -178, .4, undefined, undefined, undefined, undefined, undefined, .71, .27]);
    }

    playUpgradeMusical() {
        // upgrade musical
        return this.playSfx([0.8, undefined, 866, 0, .09, .41, 3, 2.6, undefined, undefined, 165, .09, .12, undefined, undefined, undefined, .03, .98, .11, .47, 241]);
    }
}

export const audioManager = new AudioManager();
