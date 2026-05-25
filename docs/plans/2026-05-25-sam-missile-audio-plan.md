# SAM Missile Procedural Audio Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Implement fully procedural SAM launch, flight, and lock-on chiptune sound effects, and wire them dynamically into the rendering engine and diagnostics control deck.

**Architecture:** Use the established global `AudioManager` singleton backed by the lightweight `ZzFX` synthesis library. Integrate launch, lock-on, and temporal flight-pulsing loops inside `GameBoard.jsx`'s rendering and interpolation loop. Ensure full testing using Vitest and an updated interactive HTML5 Control Deck console.

**Tech Stack:** React 18, HTML5 Canvas, Vitest, ZzFX.

---

## 📋 Tasks

### Task 1: Add Unit Tests for new AudioManager interfaces

**Files:**
- Modify: `client/src/utils/AudioManager.test.js:94-121`
- Test: `client/src/utils/AudioManager.test.js`

**Step 1: Write the failing test**
Extend the existing `'verifies new interactive and planning sound playback methods'` Vitest suite in `client/src/utils/AudioManager.test.js` to include the three new SAM methods: `'playSamLaunch'`, `'playSamFlight'`, and `'playSamLockOn'`.

```javascript
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
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run client/src/utils/AudioManager.test.js`
Expected: FAIL with `TypeError: audioManager[method] is not a function` when it reaches `playSamLaunch`.

**Step 3: Write minimal implementation**
Add empty shell functions in `client/src/utils/AudioManager.js` just before the closing class brace around line 186:

```javascript
    playSamLaunch() {}
    playSamFlight() {}
    playSamLockOn() {}
```

**Step 4: Run test to verify it passes**
Run: `npx vitest run client/src/utils/AudioManager.test.js`
Expected: PASS

**Step 5: Commit**
```bash
git add client/src/utils/AudioManager.test.js client/src/utils/AudioManager.js
git commit -m "test: define SAM missile AudioManager interface shells"
```

---

### Task 2: Implement ZzFX Sound Synthesis in AudioManager

**Files:**
- Modify: `client/src/utils/AudioManager.js`
- Test: `client/src/utils/AudioManager.test.js`

**Step 1: Write the failing test**
Add a dedicated test block inside `client/src/utils/AudioManager.test.js` that spy-checks that the specific synthesized parameters are passed correctly to `ZzFXModule.zzfx` when each method is called.

```javascript
    it('verifies exact ZzFX parameters for SAM missile audio features', async () => {
        const mockContext = { state: 'running', resume: vi.fn().mockResolvedValue() };
        vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => mockContext));
        const zzfxSpy = vi.spyOn(ZzFXModule, 'zzfx').mockReturnValue(null);

        await audioManager.init();

        // 1. Launch
        audioManager.playSamLaunch();
        await new Promise(resolve => setTimeout(resolve, 5));
        expect(zzfxSpy).toHaveBeenLastCalledWith(expect.arrayContaining([180, 0.05, 0.05, 0.2]));

        // 2. Flight
        audioManager.playSamFlight();
        await new Promise(resolve => setTimeout(resolve, 5));
        expect(zzfxSpy).toHaveBeenLastCalledWith(expect.arrayContaining([75, 0.04]));

        // 3. Lock On
        audioManager.playSamLockOn();
        await new Promise(resolve => setTimeout(resolve, 5));
        expect(zzfxSpy).toHaveBeenLastCalledWith(expect.arrayContaining([950, 0.01, 0.03, 0.08]));
    });
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run client/src/utils/AudioManager.test.js`
Expected: FAIL since the methods currently are empty shells.

**Step 3: Write minimal implementation**
Implement the full synthesized parameters inside `client/src/utils/AudioManager.js`:

```javascript
    playSamLaunch() {
        // Pneumatic eject noise pop + rising frequency whistle
        this.playSfx([0.35, undefined, 180, 0.05, 0.05, 0.2, undefined, 1.2, undefined, 10, undefined, undefined, undefined, 200, 0.02]);
    }

    playSamFlight() {
        // Soft low-frequency rocket engine thruster rumble
        this.playSfx([0.08, undefined, 75, 0.04, undefined, 0.08, undefined, 0.5, undefined, -15]);
    }

    playSamLockOn() {
        // Snappy high-frequency dual-tone alarm chime
        this.playSfx([0.22, undefined, 950, 0.01, 0.03, 0.08, 1, 1.8, undefined, 10, 300, 0.02, 0.05]);
    }
```

**Step 4: Run test to verify it passes**
Run: `npx vitest run client/src/utils/AudioManager.test.js`
Expected: PASS

**Step 5: Commit**
```bash
git add client/src/utils/AudioManager.js client/src/utils/AudioManager.test.js
git commit -m "feat: implement calibrated chiptune ZzFX parameters for SAM"
```

---

### Task 3: Hook Launch and Lock-on sounds into GameBoard.jsx

**Files:**
- Modify: `client/src/components/GameBoard.jsx:263-268` and `client/src/components/GameBoard.jsx:306-310`
- Test: `npx vitest run client/src/utils/` to ensure no regression syntax errors exist.

**Step 1: Write the code changes for SAM Launch**
Locate line 263 in `client/src/components/GameBoard.jsx` which triggers projectile launches:

```javascript
                        if (serverEnt.type === 'PROJECTILE') {
                            if (serverEnt.itemType === 'HOMING_MISSILE') {
                                audioManager.playHeavyLaunch();
                            } else {
                                audioManager.playShoot();
                            }
                        }
```

Modify it to:

```javascript
                        if (serverEnt.type === 'PROJECTILE') {
                            if (serverEnt.itemType === 'HOMING_MISSILE') {
                                audioManager.playHeavyLaunch();
                            } else if (serverEnt.itemType === 'SAM_MISSILE' || serverEnt.itemType === 'SMART_SAM_MISSILE') {
                                audioManager.playSamLaunch();
                            } else {
                                audioManager.playShoot();
                            }
                        }
```

**Step 2: Write the code changes for SAM Lock On**
Locate the visual entity properties update block around line 308 in `client/src/components/GameBoard.jsx`:

```javascript
                        viz.searchMode = serverEnt.searchMode;
                        viz.lockFound = serverEnt.lockFound;
                        viz.flakActive = serverEnt.flakActive;
```

Modify it to capture the transition:

```javascript
                        viz.searchMode = serverEnt.searchMode;
                        const prevLockFound = viz.lockFound;
                        viz.lockFound = serverEnt.lockFound;
                        viz.flakActive = serverEnt.flakActive;
                        
                        // Play alert lock-on chime upon positive transition
                        if (viz.lockFound && !prevLockFound) {
                            if (serverEnt.itemType === 'SAM_MISSILE' || serverEnt.itemType === 'SMART_SAM_MISSILE' || serverEnt.itemType === 'HOMING_MISSILE') {
                                audioManager.playSamLockOn();
                            }
                        }
```

**Step 3: Run existing unit tests to verify safety**
Run: `npm run test`
Expected: PASS

**Step 4: Commit**
```bash
git add client/src/components/GameBoard.jsx
git commit -m "feat: wire SAM launch and lock-on state triggers into GameBoard simulation"
```

---

### Task 4: Hook periodic flight sound into GameBoard.jsx rendering loop

**Files:**
- Modify: `client/src/components/GameBoard.jsx`

**Step 1: Write the code changes for periodic flight sounds**
Locate the existing projectile rendering block in `client/src/components/GameBoard.jsx` around lines 880-905:

```javascript
                                // 2. Draw Vectorized Projectile Trail (Missiles only)
                                const typeForTrail = entity.itemType || entity.type;
                                const hasTrail = typeForTrail === 'HOMING_MISSILE' || typeForTrail === 'SAM_MISSILE' || typeForTrail === 'SMART_SAM_MISSILE';
                                
                                if (!displayAsGhost && hasTrail) {
```

Modify it to include the temporal flight pulse:

```javascript
                                // 2. Draw Vectorized Projectile Trail (Missiles only)
                                const typeForTrail = entity.itemType || entity.type;
                                const hasTrail = typeForTrail === 'HOMING_MISSILE' || typeForTrail === 'SAM_MISSILE' || typeForTrail === 'SMART_SAM_MISSILE';
                                
                                if (!displayAsGhost && hasTrail) {
                                    // Periodic flight sound pulse
                                    if (typeForTrail === 'SAM_MISSILE' || typeForTrail === 'SMART_SAM_MISSILE') {
                                        const now = Date.now();
                                        if (!entity.lastFlightSoundTime || now - entity.lastFlightSoundTime > 150) {
                                            audioManager.playSamFlight();
                                            entity.lastFlightSoundTime = now;
                                        }
                                    }
```

**Step 2: Run all unit tests to verify soundness**
Run: `npm run test`
Expected: PASS

**Step 3: Commit**
```bash
git add client/src/components/GameBoard.jsx
git commit -m "feat: implement client-side periodic flight sound loop for SAM interceptors"
```

---

### Task 5: Add Calibration controls in Audio Diagnostics Console

**Files:**
- Modify: `client/public/debug-audio.html`

**Step 1: Add diagnostic UI buttons**
Locate the chiptune buttons grid around lines 360-375 in `client/public/debug-audio.html`:

```html
            <button class="sfx-btn heavy" data-sfx="actionReset">
                <span>14. RESET BUZZ</span>
                <span class="btn-desc">Descending rejection error buzz</span>
            </button>
            <button class="sfx-btn heavy" data-sfx="structureLanding">
                <span>15. DROP LANDING</span>
                <span class="btn-desc">Orbital landing hydraulic slam</span>
            </button>
```

Add three new buttons:

```html
            <button class="sfx-btn" data-sfx="samLaunch">
                <span>16. SAM LAUNCH</span>
                <span class="btn-desc">Pneumatic mechanical launch eject pop</span>
            </button>
            <button class="sfx-btn" data-sfx="samFlight">
                <span>17. SAM FLIGHT</span>
                <span class="btn-desc">Pulsed rocket engine thruster rumble</span>
            </button>
            <button class="sfx-btn green" data-sfx="samLock">
                <span>18. SAM LOCK ON</span>
                <span class="btn-desc">High pitch dual-tone target lock chime</span>
            </button>
```

**Step 2: Add ZzFX parameter definitions**
Locate `const sfxParams` around lines 390-408 in `client/public/debug-audio.html`:

```javascript
            actionReset: [0.2, undefined, 150, .02, .05, .12, undefined, undefined, undefined, -15],
            structureLanding: [0.55, undefined, 65, .08, .12, .35, undefined, 2.2, undefined, -3]
```

Add our calibrated SAM configurations:

```javascript
            actionReset: [0.2, undefined, 150, .02, .05, .12, undefined, undefined, undefined, -15],
            structureLanding: [0.55, undefined, 65, .08, .12, .35, undefined, 2.2, undefined, -3],
            samLaunch: [0.35, undefined, 180, 0.05, 0.05, 0.2, undefined, 1.2, undefined, 10, undefined, undefined, undefined, 200, 0.02],
            samFlight: [0.08, undefined, 75, 0.04, undefined, 0.08, undefined, 0.5, undefined, -15],
            samLock: [0.22, undefined, 950, 0.01, 0.03, 0.08, 1, 1.8, undefined, 10, 300, 0.02, 0.05]
```

**Step 3: Verify & Commit**
Commit the final files:
```bash
git add client/public/debug-audio.html
git commit -m "feat: integrate SAM procedural calibration buttons into diagnostics deck"
```
