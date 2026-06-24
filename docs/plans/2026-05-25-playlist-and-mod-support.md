# Tracker Music Playlist & `.mod` Support Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Add native `.mod` tracker music support, set `twimble.mod` as default startup track, and implement a premium in-game track selector to swap tracks in the UI and debug console.

**Architecture:** We will export a shared `TRACKS` playlist constant from `AudioManager.js`. We will then integrate track selection state and a styled dropdown menu in both `App.jsx` (the COMM AUDIO panel) and `debug-audio.html` (the diagnostics control deck).

**Tech Stack:** React 19, Vite, Vitest, Vanilla HTML/CSS/JS, `chiptune3` player.

---

### Task 1: Add Playlist Constant & Music Loader Unit Test

**Files:**
- Modify: `client/src/utils/AudioManager.js`
- Test: `client/src/utils/AudioManager.test.js`

**Step 1: Write the tests in AudioManager.test.js**
We will add a test verifying that `TRACKS` constant is exported and that `playMusic` successfully loads the specified track path.

Add this test inside the `describe('AudioManager')` block:
```javascript
    it('defines and exports a valid TRACKS playlist', () => {
        expect(TRACKS).toBeDefined();
        expect(TRACKS.length).toBe(2);
        expect(TRACKS[0].id).toBe('twimble');
        expect(TRACKS[1].id).toBe('banana');
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
```
And import `TRACKS` in the test file:
```javascript
import { audioManager, TRACKS } from './AudioManager';
```

**Step 2: Run test to verify it fails**
Run: `npm run test`
Expected: FAIL with "TRACKS is not defined" or similar.

**Step 3: Implement TRACKS playlist in AudioManager.js**
Modify `client/src/utils/AudioManager.js` to define and export `TRACKS`:
```javascript
export const TRACKS = [
    { id: 'twimble', name: 'TWIMBLE.MOD', path: '/audio/tracks/twimble.mod' },
    { id: 'banana', name: 'BANANA.XM', path: '/audio/tracks/hackurr_-_banana.xm' }
];
```

**Step 4: Run test to verify it passes**
Run: `npm run test`
Expected: PASS

**Step 5: Commit changes**
```bash
git add client/src/utils/AudioManager.js client/src/utils/AudioManager.test.js
git commit -m "test & feat: define TRACKS playlist and test music track loading"
```

---

### Task 2: Implement Track Selector in Diagnostic Control Deck

**Files:**
- Modify: `client/public/debug-audio.html`

**Step 1: Replace hardcoded track display with selector**
Modify `client/public/debug-audio.html` (lines 300-306) to include a `<select>` element:
```html
        <!-- Tracker Audio Stream -->
        <div class="tracker-section">
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
                ">
                    <option value="/audio/tracks/twimble.mod">TWIMBLE.MOD (DEFAULT)</option>
                    <option value="/audio/tracks/hackurr_-_banana.xm">BANANA.XM</option>
                </select>
            </div>
            <button class="action-btn" id="playTrackerBtn">START TRACKER</button>
        </div>
```

**Step 2: Modify initialization script for dynamic loading**
Modify lines 497-529 in `<script type="module">` of `client/public/debug-audio.html`:
```javascript
        const trackSelect = document.getElementById('trackSelect');

        // Dynamic hot-swapping when track is changed
        trackSelect.addEventListener('change', () => {
            if (chiptunePlayer) {
                playTrackerBtn.click();
            }
        });

        // Trigger Tracker music
        playTrackerBtn.addEventListener('click', async () => {
            initAudio();
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }

            if (chiptunePlayer) {
                statusText.innerText = "TERMINATING ACTIVE TRACKER...";
                try {
                    chiptunePlayer.stop();
                } catch(e) {}
            }

            statusText.innerText = "SPINNING UP TRACK PLAYER...";
            chiptunePlayer = new ChiptuneJsPlayer({
                context: audioCtx,
                repeatCount: -1
            });

            // Route chiptune player through visualizer node
            chiptunePlayer.gain.connect(analyser);

            const selectedTrack = trackSelect.value;
            const selectedText = trackSelect.options[trackSelect.selectedIndex].text;

            chiptunePlayer.onInitialized(() => {
                statusText.innerText = "BUFFERING CHIPTUNE TRACK...";
                try {
                    chiptunePlayer.load(selectedTrack);
                    statusText.innerText = "TRACK CONSOLE ACTIVE";
                } catch (err) {
                    statusText.innerText = "TRACK STREAMING ERROR: " + err.message;
                }
            });
        });
```

**Step 3: Verify the control deck in browser**
Use the browser agent to load `http://localhost:5173/debug-audio.html`. Verify that changing the dropdown selects both files correctly, hot-swapping works, and plays beautifully.

**Step 4: Commit**
```bash
git add client/public/debug-audio.html
git commit -m "feat: add interactive track selector to debug control deck"
```

---

### Task 3: Implement Playlist & Selector Dropdown in Game Interface

**Files:**
- Modify: `client/src/App.jsx`

**Step 1: Import TRACKS and initialize state**
Import `TRACKS` from `./utils/AudioManager`:
```javascript
import { audioManager, TRACKS } from './utils/AudioManager';
```
And initialize state at the top of the component:
```javascript
    const [currentTrackPath, setCurrentTrackPath] = useState('/audio/tracks/twimble.mod');
```

**Step 2: Update the warm-up interaction logic**
Ensure that the interaction logic triggers `currentTrackPath` instead of a hardcoded string:
```javascript
    // Warm up AudioContext on standard user interaction
    useEffect(() => {
        const warmUpAudio = () => {
            audioManager.playMusic(currentTrackPath);
            window.removeEventListener('click', warmUpAudio);
        };
        window.addEventListener('click', warmUpAudio);
        return () => window.removeEventListener('click', warmUpAudio);
    }, [currentTrackPath]);
```

**Step 3: Define track change handler**
Create `handleTrackChange` handler function:
```javascript
    const handleTrackChange = (path) => {
        setCurrentTrackPath(path);
        if (audioManager.isPlaying || audioManager.ctx) {
            audioManager.playMusic(path);
        }
    };
```

**Step 4: Render selector dropdown in COMM AUDIO panel**
Modify lines 525-549 to add a styled track selection menu in the panel:
```jsx
            <div className="audio-panel">
                <div className="panel-title">COMM AUDIO</div>
                <div className="audio-controls">
                    <button 
                        className={`mute-btn ${audioMuted ? 'muted' : ''}`} 
                        onClick={handleMuteToggle}
                        title={audioMuted ? "Unmute Audio" : "Mute Audio"}
                    >
                        {audioMuted ? "OFF" : "ON"}
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
                <div className="track-selector-container" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span className="slider-label" style={{ fontSize: '0.75rem', color: '#64748b', letterSpacing: '1px' }}>TRACK:</span>
                    <select 
                        value={currentTrackPath} 
                        onChange={(e) => handleTrackChange(e.target.value)}
                        className="retro-select"
                        style={{
                            background: 'rgba(0, 0, 0, 0.5)',
                            color: 'var(--player-accent-color)',
                            border: '1px solid var(--player-accent-glow)',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontFamily: '"Share Tech Mono", monospace',
                            fontSize: '0.85rem',
                            outline: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        {TRACKS.map(t => (
                            <option key={t.id} value={t.path}>{t.name}</option>
                        ))}
                    </select>
                </div>
            </div>
```

**Step 5: Verify the game playlist UI**
Verify that the track is playing, the volume slider operates perfectly, and changing the track hot-swaps active background audio cleanly.

**Step 6: Commit**
```bash
git add client/src/App.jsx
git commit -m "feat: integrate premium track selector into COMM AUDIO game panel"
```

---

### Task 4: Code Quality & Lint Validation

**Step 1: Run project linter**
Run: `npm run lint`
Expected: PASS with 0 lint violations.

**Step 2: Run all unit tests**
Run: `npm run test`
Expected: PASS
