# Expanded Procedural SFX Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Expand Titan: Nexus Command with a high-fidelity retro audio library of procedural ZzFX sound effects triggered dynamically in the client visual rendering loop.

**Architecture:** We will add specialized playback methods in `AudioManager.js` wrapping new mathematical ZzFX arrays, then hook into `GameBoard.jsx`'s LERP update loop to trigger sounds frame-accurately as visual entities are registered, damaged, destroyed, or network links severed.

**Tech Stack:** JavaScript, React (HTML5 Canvas rendering loop), ZzFX procedural audio synthesizer, Vitest.

---

### Task 1: Add procedural ZzFX playback methods to AudioManager

**Files:**
- Modify: [AudioManager.js](file:///home/behalr/titan-nexus-command/client/src/utils/AudioManager.js)
- Modify: [AudioManager.test.js](file:///home/behalr/titan-nexus-command/client/src/utils/AudioManager.test.js)

**Step 1: Write the failing tests**
Update [AudioManager.test.js](file:///home/behalr/titan-nexus-command/client/src/utils/AudioManager.test.js) to assert that calling each new audio playback method invokes the ZzFX synthesis engine.

```javascript
    it('verifies all procedural sound playback methods', async () => {
        const mockContext = {
            state: 'running',
            resume: vi.fn().mockResolvedValue()
        };
        vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => mockContext));
        const zzfxSpy = vi.spyOn(ZzFXModule, 'zzfx').mockReturnValue(null);

        await audioManager.init();

        const methods = [
            'playShoot',
            'playHeavyLaunch',
            'playLaser',
            'playExplosion',
            'playShieldHit',
            'playNukeDetonation',
            'playLinkSevered',
            'playStructureDestroyed'
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
Expected: FAIL due to undefined methods like `playShoot`.

**Step 3: Implement sound methods in AudioManager**
Define the 8 new functions on `AudioManager` in [AudioManager.js](file:///home/behalr/titan-nexus-command/client/src/utils/AudioManager.js) at the bottom of the class:

```javascript
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
```

**Step 4: Run tests to verify success**
Run: `npx vitest run client/src/utils/AudioManager.test.js`
Expected: PASS

**Step 5: Commit**
```bash
git add client/src/utils/AudioManager.js client/src/utils/AudioManager.test.js
git commit -m "feat: implement procedural sound methods and tests in AudioManager"
```

---

### Task 2: Trigger SFX Frame-Accurately in GameBoard LERP loops

**Files:**
- Modify: [GameBoard.jsx](file:///home/behalr/titan-nexus-command/client/src/components/GameBoard.jsx:250-366)

**Step 1: Write integration test**
Add a test file `client/src/components/GameBoardAudio.test.jsx` that mocks `audioManager` and renders `GameBoard` component under simulated state updates.
Alternatively, write a visual loop verification test in `client/src/utils/GameBoardAudio.test.js` importing the logic, or since Canvas requires complex stubbing, check that `audioManager` calls are invoked when adding entities.

**Step 2: Implement spawns and triggers in visual update block**
Locate the LERP visual update block inside [GameBoard.jsx](file:///home/behalr/titan-nexus-command/client/src/components/GameBoard.jsx).
1. In `currentGameState.entities.forEach((serverEnt) => {` where `!visualEntities.current[serverEnt.id]` triggers:
   ```javascript
   // Play launch/firing sounds
   if (serverEnt.type === 'PROJECTILE') {
       if (serverEnt.itemType === 'HOMING_MISSILE') {
           audioManager.playHeavyLaunch();
       } else {
           audioManager.playShoot();
       }
   } else if (serverEnt.type === 'LASER_BEAM') {
       audioManager.playLaser();
   } else if (serverEnt.type === 'EXPLOSION') {
       if (serverEnt.itemType === 'NUKE') {
           audioManager.playNukeDetonation();
       } else {
           audioManager.playExplosion();
       }
   } else if (serverEnt.type === 'SHIELD_HIT' || serverEnt.type === 'LINK_COLLISION' || serverEnt.type === 'SPARK') {
       audioManager.playShieldHit();
   }
   ```

2. Locate structure attributes copy block:
   ```javascript
   // If entity takes damage, play impact sound
   if (serverEnt.hp < viz.hp) {
       audioManager.playShieldHit();
   }
   ```

3. In dead visual entities pruning block:
   ```javascript
   // If a structure disappears, play structural destroyed sound
   const STRUCTURE_TYPES = ['HUB', 'EXTRACTOR', 'SHIELD', 'CLOAKING_FIELD', 'TURRET', 'RELAY', 'BARRIER'];
   if (STRUCTURE_TYPES.includes(viz.type)) {
       // Only play if previously visible or scouted
       if (viz.scouted !== false) {
           audioManager.playStructureDestroyed();
       }
   }
   ```

4. Locate the pruned link block:
   ```javascript
   Object.keys(visualLinks.current).forEach((linkId) => {
       const viz = visualLinks.current[linkId];
       const inServer = currentGameState.links.some((l) => `${l.from}-${l.to}` === linkId);

       if (!inServer) {
           const from = visualEntities.current[viz.from];
           const to = visualEntities.current[viz.to];

           // If link endpoints were scouted/visible, play snap sound
           if ((from && from.scouted) || (to && to.scouted)) {
               audioManager.playLinkSevered();
           }
           delete visualLinks.current[linkId];
       }
   });
   ```

**Step 3: Run the project-wide linter**
Run: `npm run lint`
Expected: PASS with no unused variables or unresolved imports.

**Step 4: Commit**
```bash
git add client/src/components/GameBoard.jsx
git commit -m "feat: integrate procedural audio triggers into GameBoard visual update loop"
```

---

## Verification Plan

### Automated Tests
- Run all audio manager and synthesizer unit tests:
  `npx vitest run client/src/utils/`
  Expected: PASS

### Manual Verification
1. Start the development environment: `npm run dev`
2. Open two browser windows, join a seat on each to initiate a match.
3. Fire basic weapons (e.g., standard projectiles) and verify clean retro launch and standard explosion sounds.
4. Launch missiles (e.g., Homing Missile) and verify deep rumbling launch sound.
5. Create extensor cables/links and shoot them down to verify descending snap sound.
6. Damage structures to hear pings/hits, and destroy a structure to verify the digital breakdown collapse sound.
7. Launch a Nuke and verify the massive deep boom at detonation.
