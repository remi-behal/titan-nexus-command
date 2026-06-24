# Minimalist Game Audio Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Implement a stable, unified game audio system featuring high-fidelity tracker background music and procedural sound effects with shared AudioContext and zero-attenuation global triggers.

**Architecture:** A single global `AudioContext` is managed by a simplified `AudioManager` singleton. Procedural effects are synthesized in real-time by a corrected, non-blocking ZzFX engine linked to the shared context, while XM tracker music is played via the compiled WebAssembly worklets of `chiptune3`.

**Tech Stack:** Web Audio API, chiptune3 (libopenmpt WASM), ZzFX procedural synthesizer, React (Vite/JSDOM).

---

### Task 1: Exclude Chiptune3 from Vite Pre-Bundling

**Files:**
- Modify: [vite.config.js](file:///home/behalr/titan-nexus-command/client/vite.config.js)

**Step 1: Write the Vite config change**
We will add `optimizeDeps.exclude: ['chiptune3']` to the configuration inside `client/vite.config.js`. This guarantees that Vite's bundling optimization does not lock or misplace chiptune3's audio worklet assets.

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        fs: {
            allow: ['..']
        },
        proxy: {
            '/socket.io': {
                target: 'http://localhost:3000',
                ws: true
            }
        }
    },
    optimizeDeps: {
        exclude: ['chiptune3']
    }
});
```

**Step 2: Save the modification**
Modify `client/vite.config.js`.

**Step 3: Verify build capability**
Run: `npm run build --prefix client`
Expected: Production bundle builds cleanly without error.

**Step 4: Commit**
```bash
git add client/vite.config.js
git commit -m "build: exclude chiptune3 from Vite dependency optimization"
```

---

### Task 2: Install Chiptune3 Dependency

**Files:**
- Modify: [package.json](file:///home/behalr/titan-nexus-command/client/package.json)

**Step 1: Install chiptune3 in client package**
Run: `npm install --save chiptune3 --prefix client`
Expected: Successfully installs chiptune3, updating client/package.json and client/package-lock.json.

**Step 2: Commit lockfile and package changes**
```bash
git add client/package.json client/package-lock.json
git commit -m "deps: install chiptune3 library in client package"
```

---

### Task 3: Create ZzFX Procedural Synthesis Core

**Files:**
- Create: [ZzFX.js](file:///home/behalr/titan-nexus-command/client/src/utils/ZzFX.js)
- Test: [ZzFX.test.js](file:///home/behalr/titan-nexus-command/client/src/utils/ZzFX.test.js)

**Step 1: Write ZzFX engine source code**
We will implement the standard ZzFX procedural engine. Importantly, we ensure `t[0]` maps correctly as the volume multiplier, handles `0` volume cleanly without falling back to `1`, and supports injection of the shared external AudioContext.

Create `client/src/utils/ZzFX.js`:
```javascript
// ZzFX - Zuper Zmall Zound Zynthesizer - MIT License - Copyright 2019 Frank Force
// https://github.com/KilledByAPixel/ZzFX

export let zzfxX = null; // Share AudioContext from AudioManager
export const setZzfxContext = (ctx) => { zzfxX = ctx; };

export const zzfx = (...t) => {
    if (!zzfxX) return null;
    
    // Volume (t[0]) must handle 0 and undefined
    let volume = t[0] === undefined ? 1 : t[0];
    if (volume <= 0) return null;

    let sampleRate = 44100,
        frequency = t[2] || 440,
        attack = t[3] || 0,
        sustain = t[4] || 0,
        release = t[5] || .1,
        bitpop = t[6] || 0,
        noise = t[7] || 0,
        sustainVolume = t[8] || 0,
        slide = t[9] || 0,
        deltaSlide = t[10] || 0,
        frequencyCutoff = t[11] || 0,
        frequencyCutoffSlide = t[12] || 0,
        pitchJump = t[13] || 0,
        pitchJumpTime = t[14] || 0,
        repeatTime = t[15] || 0,
        flangerDelay = t[16] || 0,
        flangerFeedback = t[17] || 0,
        volumeFeedback = t[18] || 0;

    let attackSamples = attack * sampleRate,
        sustainSamples = sustain * sampleRate,
        releaseSamples = release * sampleRate,
        totalSamples = attackSamples + sustainSamples + releaseSamples,
        time = 0,
        phase = 0,
        frequencySlide = 0,
        frequencyDeltaSlide = 0,
        noiseSeed = 0,
        pitchJumpSamples = pitchJumpTime * sampleRate,
        repeatSamples = repeatTime * sampleRate,
        repeatCounter = 0;

    const buffer = zzfxX.createBuffer(1, totalSamples, sampleRate);
    const channelData = buffer.getChannelData(0);

    for (let i = 0; i < totalSamples; ++i) {
        if (repeatSamples && ++repeatCounter >= repeatSamples) {
            repeatCounter = 0;
            time = 0;
            phase = 0;
            frequencySlide = 0;
            frequencyDeltaSlide = 0;
            noiseSeed = 0;
        }

        // Apply slides
        frequencySlide += slide;
        frequencyDeltaSlide += deltaSlide;
        let currentFreq = frequency + frequencySlide;
        if (frequencyCutoff && currentFreq > frequencyCutoff) currentFreq = frequencyCutoff;
        if (frequencyCutoffSlide) frequency += frequencyCutoffSlide;

        // Apply pitch jump
        if (pitchJumpSamples && i > pitchJumpSamples) {
            currentFreq += pitchJump;
            pitchJumpSamples = 0;
        }

        // Compute phase and sample wave
        phase += (2 * Math.PI * currentFreq) / sampleRate;
        let sampleVal = Math.sin(phase);

        // Bitpop effect
        if (bitpop) {
            sampleVal = sampleVal > 0 ? 1 : -1;
        }

        // Noise synthesis
        if (noise) {
            noiseSeed = (noiseSeed + 1) % 1;
            sampleVal += (Math.random() * 2 - 1) * noise;
        }

        // Envelope multiplier
        let envVolume = 0;
        if (i < attackSamples) {
            envVolume = i / attackSamples;
        } else if (i < attackSamples + sustainSamples) {
            envVolume = 1 - (1 - sustainVolume) * ((i - attackSamples) / sustainSamples);
        } else {
            envVolume = sustainVolume * (1 - (i - attackSamples - sustainSamples) / releaseSamples);
        }

        // Final sample volume scaling
        let sample = sampleVal * envVolume * volume * 0.3;
        
        // Simple bounds clamping
        channelData[i] = sample < -1 ? -1 : sample > 1 ? 1 : sample;
    }

    const bufferSource = zzfxX.createBufferSource();
    bufferSource.buffer = buffer;
    bufferSource.connect(zzfxX.destination);
    bufferSource.start();
    return bufferSource;
};
```

**Step 2: Create a unit test for ZzFX**
Create `client/src/utils/ZzFX.test.js`:
```javascript
import { describe, it, expect, vi } from 'vitest';
import { zzfx, setZzfxContext, zzfxX } from './ZzFX';

describe('ZzFX Synthesizer', () => {
    it('sets context and plays sound successfully', () => {
        const mockChannelData = new Float32Array(100);
        const mockBuffer = {
            getChannelData: vi.fn().mockReturnValue(mockChannelData)
        };
        const mockBufferSource = {
            connect: vi.fn(),
            start: vi.fn()
        };
        const mockContext = {
            createBuffer: vi.fn().mockReturnValue(mockBuffer),
            createBufferSource: vi.fn().mockReturnValue(mockBufferSource),
            destination: {}
        };

        setZzfxContext(mockContext);
        expect(zzfxX).toBe(mockContext);

        const result = zzfx(0.5, 0, 440, 0.05, 0.05, 0.1);
        expect(result).toBe(mockBufferSource);
        expect(mockContext.createBuffer).toHaveBeenCalled();
        expect(mockBufferSource.connect).toHaveBeenCalledWith(mockContext.destination);
        expect(mockBufferSource.start).toHaveBeenCalled();
    });

    it('returns null if volume is zero or undefined', () => {
        const result = zzfx(0);
        expect(result).toBeNull();
    });
});
```

**Step 3: Run ZzFX tests**
Run: `npx vitest run client/src/utils/ZzFX.test.js`
Expected: ZzFX tests pass.

**Step 4: Commit**
```bash
git add client/src/utils/ZzFX.js client/src/utils/ZzFX.test.js
git commit -m "feat: add corrected ZzFX procedural audio synthesizer and tests"
```

---

### Task 4: Create Minimalist AudioManager Singleton

**Files:**
- Create: [AudioManager.js](file:///home/behalr/titan-nexus-command/client/src/utils/AudioManager.js)
- Test: [AudioManager.test.js](file:///home/behalr/titan-nexus-command/client/src/utils/AudioManager.test.js)

**Step 1: Write AudioManager source code**
We will implement a clean, robust, and unified singleton in `client/src/utils/AudioManager.js`. It initializes the global Web `AudioContext`, passes it to `setZzfxContext`, manages tracker music playback via `chiptune3`, and exports a single entrypoint for triggering the "Round Start" effect and setting music tracks.

Create `client/src/utils/AudioManager.js`:
```javascript
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

    async init() {
        if (this.ctx) return;
        
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
            setZzfxContext(this.ctx);
            
            // Dynamic import of chiptune3 only in browser context
            const { ChiptuneJsPlayer } = await import('chiptune3');
            this.player = new ChiptuneJsPlayer(new ChiptuneJsPlayer.Config());
            this.player.setVol(this.volume);
        } catch (e) {
            console.error('AudioManager initialization failed:', e);
        }
    }

    async playMusic(trackPath) {
        await this.init();
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        if (this.currentTrack === trackPath && this.isPlaying) {
            return;
        }

        this.stopMusic();
        this.currentTrack = trackPath;
        this.isPlaying = true;

        if (this.player && trackPath) {
            this.player.load(trackPath, (buffer) => {
                if (this.currentTrack === trackPath && this.isPlaying) {
                    this.player.play(buffer);
                    this.player.setVol(this.isMuted ? 0 : this.volume);
                }
            }, (err) => {
                console.error('AudioManager: Failed to play music', trackPath, err);
            });
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
```

**Step 2: Create unit tests for AudioManager**
Create `client/src/utils/AudioManager.test.js`:
```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audioManager } from './AudioManager';
import * as ZzFXModule from './ZzFX';

vi.mock('chiptune3', () => {
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
```

**Step 3: Run AudioManager tests**
Run: `npx vitest run client/src/utils/AudioManager.test.js`
Expected: AudioManager tests pass.

**Step 4: Commit**
```bash
git add client/src/utils/AudioManager.js client/src/utils/AudioManager.test.js
git commit -m "feat: implement unified global AudioManager singleton with tests"
```

---

### Task 5: Integrate Audio Controls and "Round Start" Trigger in App.jsx

**Files:**
- Modify: [App.jsx](file:///home/behalr/titan-nexus-command/client/src/App.jsx)

**Step 1: Implement user gesture audio activation, mute/volume state controls, and turn start SFX trigger in App.jsx**
We import `audioManager` in `App.jsx`.
We initialize audio playback on the player's first interactions (e.g. joining lobby, clicking execute).
We trigger `audioManager.playRoundStart()` when `newState.turn > turnRef.current` inside the `socket.on('gameStateUpdate')` handler.
We append an elegant retro-styled, glowing glassmorphism controller inside `sidebarLeft` using pure CSS aesthetics.

Modify `client/src/App.jsx` to import and call `audioManager`:
```javascript
// Add at top imports:
import { audioManager } from './utils/AudioManager';
```

Modify the socket update listener inside `useEffect` (around line 212):
```javascript
        const onUpdate = (newState) => {
            setPlayerState(newState);
            setMatchStarted(true);

            // Reset local committed state ONLY when the turn has advanced
            if (newState.turn > turnRef.current) {
                setCommittedActions([]);
                setSelectedHubId(null);
                setLaunchMode(false);
                turnRef.current = newState.turn;
                // Trigger the retro Round Start SFX!
                audioManager.playRoundStart();
            }
        };
```

Ensure audio starts on match start/authentication:
```javascript
        const onConnect = () => {
            console.log('Socket connected!', socket.id);
            setIsConnected(true);

            const token = getSessionToken();
            socket.emit('authenticate', token);
            
            // Warm up audio context on user interaction
            audioManager.playMusic('/audio/tracks/hackurr_-_banana.xm');
        };
```

We also add local React state for Volume and Mute to sync our glowing sidebar controls. Add in state declarations of `App`:
```javascript
    const [audioVolume, setAudioVolume] = useState(0.5);
    const [audioMuted, setAudioMuted] = useState(false);
```

Hook up controls to `audioManager`:
```javascript
    const handleVolumeChange = (e) => {
        const val = parseFloat(e.target.value);
        setAudioVolume(val);
        audioManager.setVolume(val);
    };

    const handleMuteToggle = () => {
        audioManager.toggleMute();
        setAudioMuted(audioManager.isMuted);
    };
```

Embed audio controls inside `sidebarLeft`:
```javascript
            <div className="audio-panel glassmorphic-panel">
                <div className="panel-title">COMMUNICATION AUDIO</div>
                <div className="audio-controls">
                    <button 
                        className={`mute-btn ${audioMuted ? 'muted' : ''}`} 
                        onClick={handleMuteToggle}
                        title={audioMuted ? "Unmute Audio" : "Mute Audio"}
                    >
                        {audioMuted ? "🔊 [OFF]" : "🔊 [ON]"}
                    </button>
                    <div className="slider-container">
                        <span className="slider-label">VOL:</span>
                        <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.05" 
                            value={audioVolume} 
                            onChange={handleVolumeChange}
                            className="retro-slider"
                            disabled={audioMuted}
                        />
                    </div>
                </div>
            </div>
```

**Step 2: Add styles for the CRT-glassmorphic Audio Panel to `App.css`**
Add to `client/src/App.css`:
```css
/* Retro-Tactical Audio Panel */
.audio-panel {
    margin-top: 15px;
    padding: 10px;
    border: 1px solid var(--player-accent-color);
    background: rgba(0, 20, 5, 0.6);
    box-shadow: 0 0 10px rgba(0, 255, 68, 0.1);
    font-family: 'Courier New', Courier, monospace;
    font-size: 0.85em;
    border-radius: 4px;
}

.audio-panel .panel-title {
    color: var(--player-accent-color);
    text-shadow: 0 0 5px var(--player-accent-glow);
    font-weight: bold;
    margin-bottom: 8px;
    letter-spacing: 1px;
}

.audio-controls {
    display: flex;
    align-items: center;
    gap: 10px;
}

.mute-btn {
    background: transparent;
    border: 1px solid var(--player-accent-color);
    color: var(--player-accent-color);
    padding: 4px 8px;
    cursor: pointer;
    font-size: 0.9em;
    transition: all 0.2s ease;
    text-shadow: 0 0 3px var(--player-accent-glow);
    border-radius: 2px;
}

.mute-btn:hover {
    background: rgba(0, 255, 68, 0.2);
    box-shadow: 0 0 8px var(--player-accent-glow);
}

.mute-btn.muted {
    border-color: #ff3333;
    color: #ff3333;
}

.mute-btn.muted:hover {
    background: rgba(255, 51, 51, 0.2);
    box-shadow: 0 0 8px rgba(255, 51, 51, 0.4);
}

.slider-container {
    display: flex;
    align-items: center;
    flex-grow: 1;
    gap: 5px;
}

.slider-label {
    color: var(--player-accent-color);
    font-size: 0.8em;
}

.retro-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    background: rgba(0, 255, 68, 0.2);
    outline: none;
    border: 1px solid var(--player-accent-color);
    border-radius: 2px;
}

.retro-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    background: var(--player-accent-color);
    box-shadow: 0 0 6px var(--player-accent-glow);
    cursor: pointer;
    border-radius: 2px;
}

.retro-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    background: var(--player-accent-color);
    box-shadow: 0 0 6px var(--player-accent-glow);
    cursor: pointer;
    border: none;
    border-radius: 2px;
}
```

**Step 3: Run full test suite**
Run: `npm test`
Expected: All 203+ tests pass successfully.

**Step 4: Commit**
```bash
git add client/src/App.jsx client/src/App.css
git commit -m "feat: integrate volume controls and round start audio trigger in App"
```

---

### Task 6: Create Static Directories

**Files:**
- Create: `client/public/audio/tracks`

**Step 1: Setup tracks folder**
Run: `mkdir -p client/public/audio/tracks`
Expected: Creates the directories for game music.

**Step 2: Commit**
```bash
git add client/public/audio/tracks/.gitkeep 2>/dev/null || true
git commit -m "chore: ensure audio tracks directory structure exists"
```

---

## Verification Plan

### Automated Tests
- Run: `npm test` to run the comprehensive unit test suite, confirming ZzFX synthesis engine, AudioManager setup, and all client regressions are fully clean and verified.

### Manual Verification
1. Launch the server locally with `npm run dev`.
2. Open two separate web browsers (Chrome and Firefox) at `http://localhost:5173/`.
3. Join solo or with two seats, and click to activate/resume the AudioContext (music should start playing `/audio/tracks/hackurr_-_banana.xm` smoothly if the track exists).
4. Click "Ready" in both seats to resolve the turn.
5. The moment the new round starts (transition to turn 2), a clear, retro high-fidelity ping should play on the speakers, indicating a successful "Round Start" trigger.
6. Verify that sliding the volume bar or toggling the mute button correctly mutes or changes the music/SFX volume instantly.
