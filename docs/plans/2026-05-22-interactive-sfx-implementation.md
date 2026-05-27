# Interactive & Planning SFX Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Implement 7 new procedural ZzFX sound effects providing tactile audio feedback for seat claims, UI clicks, outpost selections, link staging, turn telemetry uploads, action resets, and outpost landing impacts.

**Architecture:** We will define these custom ZzFX sound methods inside `AudioManager.js` using explicit `undefined` entries for ESLint compliance, and integrate direct, high-performance trigger calls inside `App.jsx` and `GameBoard.jsx` event handlers.

**Tech Stack:** JavaScript, React, ZzFX synthesis engine, Vitest.

---

### Task 1: Add new procedural ZzFX sound methods to AudioManager

**Files:**
- Modify: [AudioManager.js](file:///home/behalr/titan-nexus-command/client/src/utils/AudioManager.js)
- Modify: [AudioManager.test.js](file:///home/behalr/titan-nexus-command/client/src/utils/AudioManager.test.js)

**Step 1: Write the failing tests**
Update [AudioManager.test.js](file:///home/behalr/titan-nexus-command/client/src/utils/AudioManager.test.js) to assert that calling each new audio playback method invokes the ZzFX synthesis engine.

```javascript
    it('verifies new interactive and planning sound playback methods', async () => {
        const mockContext = {
            state: 'running',
            resume: vi.fn().mockResolvedValue()
        };
        vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => mockContext));
        const zzfxSpy = vi.spyOn(ZzFXModule, 'zzfx').mockReturnValue(null);

        await audioManager.init();

        const methods = [
            'playClick',
            'playSeatClaim',
            'playUplink',
            'playTerminalSelect',
            'playLinkStage',
            'playActionReset',
            'playStructureLanding'
        ];

        for (const method of methods) {
            audioManager[method]();
            // Wait for microtasks to resolve
            await new Promise(resolve => setTimeout(resolve, 1));
            expect(zzfxSpy).toHaveBeenCalled();
            zzfxSpy.mockClear();
        }
    });
```

**Step 2: Run tests to verify failure**
Run: `npx vitest run client/src/utils/AudioManager.test.js`
Expected: FAIL due to undefined methods like `playClick`.

**Step 3: Implement sound methods in AudioManager**
Define the 7 new functions on `AudioManager` in [AudioManager.js](file:///home/behalr/titan-nexus-command/client/src/utils/AudioManager.js) at the bottom of the class:

```javascript
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
```

**Step 4: Run tests to verify success**
Run: `npx vitest run client/src/utils/AudioManager.test.js`
Expected: PASS

**Step 5: Commit**
```bash
git add client/src/utils/AudioManager.js client/src/utils/AudioManager.test.js
git commit -m "feat: add Phase 2 interactive play methods and tests to AudioManager"
```

---

### Task 2: Integrate UI SFX triggers into App.jsx

**Files:**
- Modify: [App.jsx](file:///home/behalr/titan-nexus-command/client/src/App.jsx)

**Step 1: Write the implementation**
1. Import `audioManager` at the top of [App.jsx](file:///home/behalr/titan-nexus-command/client/src/App.jsx):
   ```javascript
   import { audioManager } from './utils/AudioManager';
   ```

2. Locate seat claiming logic inside `handleClaimSeat`:
   ```javascript
   const handleClaimSeat = (seatId) => {
       audioManager.playSeatClaim();
       // ... existing seat request socket emit
   ```

3. Locate turn submission logic inside `commitActions` (or socket submit turn handler):
   ```javascript
   const commitActions = () => {
       audioManager.playUplink();
       // ... existing committed actions submission
   ```

4. Locate other primary UI button handlers (like the Ready Checkbox or action drawers) and add:
   ```javascript
   audioManager.playClick();
   ```

**Step 2: Run linter**
Run: `npm run lint`
Expected: PASS with zero ESLint failures.

**Step 3: Commit**
```bash
git add client/src/App.jsx
git commit -m "feat: integrate interactive UI SFX clicks and uplink sweep inside App.jsx"
```

---

### Task 3: Integrate selections, staging, and landings into GameBoard.jsx

**Files:**
- Modify: [GameBoard.jsx](file:///home/behalr/titan-nexus-command/client/src/components/GameBoard.jsx)

**Step 1: Write the implementation**
1. Locate structure orbital landing trigger within LERP visual updates (where `!visualEntities.current[serverEnt.id]` triggers):
   ```javascript
   const STRUCTURE_TYPES = ['HUB', 'EXTRACTOR', 'SHIELD', 'CLOAKING_FIELD', 'TURRET', 'RELAY', 'BARRIER'];
   if (STRUCTURE_TYPES.includes(serverEnt.type)) {
       audioManager.playStructureLanding();
   }
   ```

2. Locate click selection logic inside `handleCanvasClick` (or where selected outpost state is set):
   ```javascript
   // Play terminal select chirp when outpost is selected under mouse
   if (clickedEntity && clickedEntity.type && STRUCTURE_TYPES.includes(clickedEntity.type)) {
       audioManager.playTerminalSelect();
   }
   ```

3. Locate staged actions adding logic (where link actions are pushed to the staging queue):
   ```javascript
   // Play cybernetic stretching chime when link is staged
   audioManager.playLinkStage();
   ```

4. Locate action reset/clear triggers (such as clicking the "Clear" button):
   ```javascript
   // Play reset sound when clearing staged moves
   audioManager.playActionReset();
   ```

**Step 2: Run full test suite and linter**
Run: `npm test && npm run lint`
Expected: PASS

**Step 3: Commit**
```bash
git add client/components/GameBoard.jsx
git commit -m "feat: integrate outpost selection, link staging, action resets, and orbital landings in GameBoard.jsx"
```

---

### Task 4: Calibrate ZzFX in the Debug soundboard console

**Files:**
- Modify: [debug-audio.html](file:///home/behalr/titan-nexus-command/client/public/debug-audio.html)

**Step 1: Update soundboard interface**
Add the new sound effects buttons to the diagnostics sound grid so they can be triggered individually.

**Step 2: Run linter**
Run: `npm run lint`
Expected: PASS

**Step 3: Commit**
```bash
git add client/public/debug-audio.html
git commit -m "feat: expose all Phase 2 sound effects on the diagnostic audio console"
```

---

## Verification Plan

### Automated Tests
- Run all audio manager and visualizer unit tests:
  `npx vitest run client/src/utils/`
  Expected: PASS

### Manual Verification
1. Start development server: `npm run dev`
2. Open `/debug-audio.html` in browser and test click, seat claim, uplink, selection, staging, clear, and orbital landing.
3. Open two seats in-game and join seats to confirm mechanical lock-in sound.
4. Select outposts, stage cable links, click clear buttons, and submit turns to verify real-time auditory plan feedback.
