# Advanced Audio Player Controls Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Implement pause, play (resume), next track, previous track, and shuffle controls in both the in-game UI and the diagnostic control deck.

**Architecture:** We will extend the `AudioManager` singleton with methods for tracking pause, shuffle, and playlist navigation state, then build matching styled control grids in `App.jsx` and `debug-audio.html` that respect the dark `#000` retro-tactical cyberpunk UI styling.

**Tech Stack:** React 19, WASM Chiptune player, Vanilla HTML/CSS/JS.

---

### Task 1: Expand `AudioManager.js` with Playlist Control Logic

**Files:**
- Modify: `client/src/utils/AudioManager.js`
- Test: `client/src/utils/AudioManager.test.js`

**Step 1: Write failing tests in AudioManager.test.js**
We will add test cases verifying the new state controls:
```javascript
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

        const nextTrack = audioManager.nextTrack();
        expect(nextTrack).toBe(TRACKS[1].path);

        const prevTrack = audioManager.prevTrack();
        expect(prevTrack).toBe(TRACKS[0].path);

        audioManager.toggleShuffle();
        expect(audioManager.shuffle).toBe(true);
    });
```

**Step 2: Run tests to verify they fail**
Run: `npm run test`
Expected: FAIL due to missing methods/properties.

**Step 3: Implement new variables and methods in AudioManager.js**
Extend `AudioManager` constructor:
```javascript
        this.isPaused = false;
        this.shuffle = false;
```
Extend `playMusic(trackPath)`:
```javascript
    async playMusic(trackPath) {
        this.isPaused = false;
        this.isPlaying = true;
        ...
```
Add new control methods:
```javascript
    pauseMusic() {
        if (this.player && this.isPlaying) {
            this.player.pause();
            this.isPaused = true;
            this.isPlaying = false;
        }
    }

    resumeMusic() {
        if (this.player && this.isPaused) {
            this.player.unpause();
            this.isPaused = false;
            this.isPlaying = true;
        } else if (this.currentTrack) {
            this.playMusic(this.currentTrack);
        } else {
            this.playMusic(TRACKS[0].path);
        }
    }

    nextTrack() {
        let nextIndex;
        if (this.shuffle) {
            nextIndex = Math.floor(Math.random() * TRACKS.length);
        } else {
            const currentIndex = TRACKS.findIndex(t => t.path === this.currentTrack);
            nextIndex = (currentIndex + 1) % TRACKS.length;
        }
        const track = TRACKS[nextIndex];
        this.playMusic(track.path);
        return track.path;
    }

    prevTrack() {
        let prevIndex;
        if (this.shuffle) {
            prevIndex = Math.floor(Math.random() * TRACKS.length);
        } else {
            const currentIndex = TRACKS.findIndex(t => t.path === this.currentTrack);
            prevIndex = (currentIndex - 1 + TRACKS.length) % TRACKS.length;
        }
        const track = TRACKS[prevIndex];
        this.playMusic(track.path);
        return track.path;
    }

    toggleShuffle() {
        this.shuffle = !this.shuffle;
        return this.shuffle;
    }
```

**Step 4: Run tests to verify they pass**
Run: `npm run test`
Expected: PASS

**Step 5: Commit**
```bash
git add client/src/utils/AudioManager.js client/src/utils/AudioManager.test.js
git commit -m "feat & test: add advanced playback control state and methods to AudioManager"
```

---

### Task 2: Implement UI Synth CSS in `App.css`

**Files:**
- Modify: `client/src/App.css`

**Step 1: Append styles matching the `#000` retro-tactical console layout**
```css
.track-selector-container {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.retro-select {
    background: #000;
    color: #aaa;
    border: 1px solid #444;
    padding: 3px 6px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 0.65rem;
    font-weight: bold;
    border-radius: 2px;
    outline: none;
    cursor: pointer;
    width: 100%;
}

.retro-select:hover {
    border-color: var(--player-accent-color, #00ff44);
    color: var(--player-accent-color, #00ff44);
}

.media-controls-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    margin-top: 6px;
}

.media-btn {
    background: #000;
    border: 1px solid #444;
    color: #aaa;
    padding: 4px 0;
    cursor: pointer;
    font-family: 'Courier New', Courier, monospace;
    font-size: 0.6rem;
    font-weight: bold;
    border-radius: 2px;
    text-align: center;
    transition: all 0.2s ease;
}

.media-btn:hover {
    border-color: var(--player-accent-color, #00ff44);
    color: var(--player-accent-color, #00ff44);
}

.media-btn.active {
    border-color: var(--player-accent-color, #00ff44);
    color: var(--player-accent-color, #00ff44);
    background: rgba(0, 255, 68, 0.1);
    box-shadow: 0 0 4px var(--player-accent-glow, rgba(0, 255, 68, 0.3));
}
```

**Step 2: Commit**
```bash
git add client/src/App.css
git commit -m "style: add retro-tactical media controller css styles"
```

---

### Task 3: Integrate Synth Controls UI inside `App.jsx`

**Files:**
- Modify: `client/src/App.jsx`

**Step 1: Wire local states in App.jsx**
Add reactive states for play/pause status and shuffle:
```javascript
    const [audioPaused, setAudioPaused] = useState(false);
    const [audioPlaying, setAudioPlaying] = useState(false);
    const [audioShuffle, setAudioShuffle] = useState(false);
```

**Step 2: Add handle triggers**
```javascript
    const handlePlayPauseToggle = () => {
        if (audioManager.isPlaying) {
            audioManager.pauseMusic();
        } else {
            audioManager.resumeMusic();
        }
        setAudioPaused(audioManager.isPaused);
        setAudioPlaying(audioManager.isPlaying);
    };

    const handleNextTrack = () => {
        const nextPath = audioManager.nextTrack();
        setCurrentTrackPath(nextPath);
        setAudioPaused(false);
        setAudioPlaying(true);
    };

    const handlePrevTrack = () => {
        const prevPath = audioManager.prevTrack();
        setCurrentTrackPath(prevPath);
        setAudioPaused(false);
        setAudioPlaying(true);
    };

    const handleShuffleToggle = () => {
        const nextShuffle = audioManager.toggleShuffle();
        setAudioShuffle(nextShuffle);
    };

    // Override handleTrackChange to synchronize state
    const handleTrackChange = (path) => {
        setCurrentTrackPath(path);
        audioManager.playMusic(path);
        setAudioPaused(false);
        setAudioPlaying(true);
    };
```

**Step 3: Update COMM AUDIO sidebar rendering block**
Replace the track selection container inside `.audio-panel` (lines 541-564):
```jsx
                <div className="track-selector-container">
                    <span className="slider-label" style={{ fontSize: '0.55rem', color: '#666', letterSpacing: '1px' }}>TRACK:</span>
                    <select 
                        value={currentTrackPath} 
                        onChange={(e) => handleTrackChange(e.target.value)}
                        className="retro-select"
                    >
                        {TRACKS.map(t => (
                            <option key={t.id} value={t.path}>{t.name}</option>
                        ))}
                    </select>
                    
                    <div className="media-controls-grid">
                        <button className="media-btn" onClick={handlePrevTrack} title="Previous Track">
                            PREV
                        </button>
                        <button 
                            className={`media-btn ${audioPlaying ? 'active' : ''}`} 
                            onClick={handlePlayPauseToggle} 
                            title={audioPlaying ? "Pause" : "Play"}
                        >
                            {audioPlaying ? "PAUS" : "PLAY"}
                        </button>
                        <button className="media-btn" onClick={handleNextTrack} title="Next Track">
                            NEXT
                        </button>
                        <button 
                            className={`media-btn ${audioShuffle ? 'active' : ''}`} 
                            onClick={handleShuffleToggle} 
                            title="Toggle Shuffle"
                        >
                            SHUF
                        </button>
                    </div>
                </div>
```

**Step 4: Commit**
```bash
git add client/src/App.jsx
git commit -m "feat: implement Synth Media Controls in COMM AUDIO sidebar panel"
```

---

### Task 4: Add Control Grid to Diagnostics Page

**Files:**
- Modify: `client/public/debug-audio.html`

**Step 1: Add Media Controls layout in debug-audio.html**
Insert the media controls buttons inside `.tracker-section`:
```html
            <div class="tracker-info">
                <span class="tracker-label">TRACKER TRACK</span>
                <select id="trackSelect" style="
                    background: rgba(0, 0, 0, 0.7);
                    color: var(--accent-green);
                    border: 1px solid var(--border-color);
                    border-radius: 4px;
                    padding: 6px 12px;
                    font-family: 'Share Tech Mono', monospace;
                    font-size: 0.95rem;
                    outline: none;
                    cursor: pointer;
                    margin-top: 5px;
                    width: 100%;
                ">
                    <option value="/audio/tracks/twimble.mod">TWIMBLE.MOD (DEFAULT)</option>
                    <option value="/audio/tracks/hackurr_-_banana.xm">BANANA.XM</option>
                </select>
                
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 8px;">
                    <button class="action-btn" id="prevBtn" style="padding: 4px 8px; font-size: 0.75rem;">PREV</button>
                    <button class="action-btn" id="playPauseBtn" style="padding: 4px 8px; font-size: 0.75rem;">PAUSE</button>
                    <button class="action-btn" id="nextBtn" style="padding: 4px 8px; font-size: 0.75rem;">NEXT</button>
                    <button class="action-btn" id="shuffleBtn" style="padding: 4px 8px; font-size: 0.75rem;">SHUF</button>
                </div>
            </div>
```

**Step 2: Add event handlers in debug script block**
```javascript
        const prevBtn = document.getElementById('prevBtn');
        const playPauseBtn = document.getElementById('playPauseBtn');
        const nextBtn = document.getElementById('nextBtn');
        const shuffleBtn = document.getElementById('shuffleBtn');
        let isShuffle = false;

        playPauseBtn.addEventListener('click', () => {
            if (!chiptunePlayer) return;
            // ChiptuneJsPlayer exposes togglePause()
            chiptunePlayer.togglePause();
            playPauseBtn.innerText = playPauseBtn.innerText === "PAUSE" ? "PLAY" : "PAUSE";
            statusText.innerText = playPauseBtn.innerText === "PAUSE" ? "TRACK PLAYING" : "TRACK PAUSED";
        });

        const triggerTrackLoad = (path) => {
            trackSelect.value = path;
            playTrackerBtn.click();
            playPauseBtn.innerText = "PAUSE";
        };

        nextBtn.addEventListener('click', () => {
            const options = Array.from(trackSelect.options);
            let nextIdx;
            if (isShuffle) {
                nextIdx = Math.floor(Math.random() * options.length);
            } else {
                const currentIdx = trackSelect.selectedIndex;
                nextIdx = (currentIdx + 1) % options.length;
            }
            triggerTrackLoad(options[nextIdx].value);
        });

        prevBtn.addEventListener('click', () => {
            const options = Array.from(trackSelect.options);
            let prevIdx;
            if (isShuffle) {
                prevIdx = Math.floor(Math.random() * options.length);
            } else {
                const currentIdx = trackSelect.selectedIndex;
                prevIdx = (currentIdx - 1 + options.length) % options.length;
            }
            triggerTrackLoad(options[prevIdx].value);
        });

        shuffleBtn.addEventListener('click', () => {
            isShuffle = !isShuffle;
            shuffleBtn.style.borderColor = isShuffle ? 'var(--accent-green)' : 'var(--border-color)';
            shuffleBtn.style.color = isShuffle ? 'var(--accent-green)' : '';
        });
```

**Step 3: Commit**
```bash
git add client/public/debug-audio.html
git commit -m "feat: implement visual media playback control deck inside diagnostics interface"
```

---

### Task 5: Code Verification & Clean Lint Check

**Step 1: Lint check**
Run: `npm run lint`
Expected: PASS with 0 lint errors on touched files.

**Step 2: Test run**
Run: `npm run test`
Expected: PASS
