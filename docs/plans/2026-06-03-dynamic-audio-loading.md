# Dynamic Audio Loading Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Implement dynamic audio loading from `zzfx_sounds.json` inside `AudioManager` and render buttons dynamically in `debug-audio.html`.

**Architecture:** We will load `zzfx_sounds.json` statically in `AudioManager.js`, dynamically define `playMethodName` for each of the 58 sounds in the constructor, and expose them as a registered list. Duplicate static methods will be removed from `AudioManager.js`. The debug control deck `debug-audio.html` will dynamically populate its UI buttons from this registered list.

**Tech Stack:** JavaScript (ES6 Modules), ZzFX, Vitest.

---

### Task 1: Dynamic Sound Registration in AudioManager

**Files:**
- Modify: `client/src/utils/AudioManager.js`
- Modify: `client/src/utils/AudioManager.test.js`

**Step 1: Write the failing test**
Open `client/src/utils/AudioManager.test.js` and add a new test that verifies a JSON-specific sound that is not currently defined statically (e.g. `playElectricalBackBuzz`) is defined and callable:

```javascript
    it('verifies dynamic JSON sound methods are defined and callable', async () => {
        expect(audioManager.playElectricalBackBuzz).toBeDefined();
        const zzfxSpy = vi.spyOn(ZzFXModule, 'zzfx').mockReturnValue(null);
        audioManager.playElectricalBackBuzz();
        expect(zzfxSpy).toHaveBeenCalled();
        zzfxSpy.mockClear();
    });
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run client/src/utils/AudioManager.test.js`
Expected: FAIL with `TypeError: audioManager.playElectricalBackBuzz is not a function` (or `toBeDefined` check failing).

**Step 3: Write minimal implementation**
1. Modify `client/src/utils/AudioManager.js` to import `zzfx_sounds.json` and register methods dynamically:
```javascript
import zzfxSounds from './zzfx_sounds.json';
```
In the `constructor()`:
```javascript
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
```
Add these methods to the class:
```javascript
    registerJsonSounds() {
        if (!zzfxSounds || !zzfxSounds.sounds) return;

        zzfxSounds.sounds.forEach(sound => {
            const nameWords = sound.name
                .replace(/[^a-zA-Z0-9\s]/g, '')
                .trim()
                .split(/\s+/);
            const camelCaseName = nameWords
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
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
        return zzfxSounds.sounds.map(sound => {
            const nameWords = sound.name
                .replace(/[^a-zA-Z0-9\s]/g, '')
                .trim()
                .split(/\s+/);
            const camelCaseName = nameWords
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join('');
            const methodName = 'play' + camelCaseName;
            return {
                name: sound.name,
                methodName,
                favorite: sound.favorite || false
            };
        });
    }
```
Delete all the static procedural methods in `client/src/utils/AudioManager.js` (lines 302–478), keeping ONLY `playHeavyErrorCombo()`.
2. Update the custom methods test in `client/src/utils/AudioManager.test.js` to dynamically loop over `getRegisteredSounds()` rather than hardcoding names.

**Step 4: Run test to verify it passes**
Run: `npx vitest run client/src/utils/AudioManager.test.js`
Expected: PASS

**Step 5: Commit**
```bash
git add client/src/utils/AudioManager.js client/src/utils/AudioManager.test.js client/src/utils/zzfx_sounds.json
git commit -m "feat: implement dynamic procedural sound registration from JSON"
```

---

### Task 2: Dynamic Sound UI in debug-audio.html

**Files:**
- Modify: `client/public/debug-audio.html`

**Step 1: Write implementation**
Modify `client/public/debug-audio.html` to load the sound buttons dynamically.
Under script section where `audioManager` is imported, modify it to clear `.sfx-grid` and generate buttons dynamically:
```javascript
        const grid = document.querySelector('.sfx-grid');
        grid.innerHTML = '';

        const registered = audioManager.getRegisteredSounds();

        registered.forEach((sound, idx) => {
            const btn = document.createElement('button');
            btn.className = sound.favorite ? 'sfx-btn green' : 'sfx-btn';
            btn.setAttribute('data-sfx', sound.methodName);
            
            const numStr = String(idx).padStart(2, '0');
            btn.innerHTML = `
                <span>${numStr}. ${sound.name.toUpperCase()}</span>
                <span class="btn-desc">Procedural dynamic zzfx sound</span>
            `;
            
            btn.addEventListener('click', async () => {
                await initAudio();
                if (audioCtx.state === 'suspended') {
                    await audioCtx.resume();
                }
                statusText.innerText = `PLAYING SFX: ${sound.methodName.toUpperCase()}`;
                const promise = audioManager[sound.methodName]();
                if (promise) {
                    const bufferSource = await promise;
                    if (bufferSource) {
                        bufferSource.connect(analyser);
                    }
                }
            });
            
            grid.appendChild(btn);
        });
```

**Step 2: Verify visually**
Launch Vite dev server: `npm run client` (or dynamically start browser subagent to test `/debug-audio.html`) and check that:
1. All 58 buttons are dynamically rendered in the grid, starting from index `00. ELECTRICAL BACK BUZZ` to index `57. LOCK ON` (or sam lock on).
2. Clicking the buttons plays the sounds correctly.

**Step 3: Commit**
```bash
git add client/public/debug-audio.html
git commit -m "feat: dynamically render sound buttons in debug audio UI"
```
