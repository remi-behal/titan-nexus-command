# Dynamic Audio Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Implement a spatial dynamic audio system where sounds play at full volume when looking at them in the map view (even if in fog of war) and scale down based on distance from the viewport when off-screen, down to a 15% floor.

**Architecture:** Use Approach 1 where GameBoard updates the AudioManager with camera context (viewport offset, size, and zoom). AudioManager computes dynamic volume multipliers using toroidal geometry and Euclidean edge falloff.

**Tech Stack:** React, HTML5 Canvas, Vitest, ZzFX.

---

### Task 1: Add Camera Context & Volume Calculation to AudioManager

**Files:**
- Modify: `client/src/utils/AudioManager.js`
- Modify: `client/src/utils/AudioManager.test.js`

**Step 1: Write the failing test**
Add tests to `client/src/utils/AudioManager.test.js` checking:
1. `updateCameraContext` sets the camera properties.
2. `calculateSpatialVolume(soundX, soundY)` returns `1.0` when no camera context is present.
3. `calculateSpatialVolume(soundX, soundY)` returns `1.0` when sound is inside the viewport box (e.g. centered in viewport).
4. `calculateSpatialVolume(soundX, soundY)` returns `0.15` when sound is extremely far away.
5. `calculateSpatialVolume(soundX, soundY)` returns an intermediate scaled value when sound is just outside the viewport edge.

```javascript
// Test chunk to add
describe('Spatial Volume calculations', () => {
    it('returns 1.0 when no camera context is registered', () => {
        expect(audioManager.calculateSpatialVolume(100, 100)).toBe(1.0);
    });

    it('returns 1.0 when sound is inside the viewport box', () => {
        audioManager.updateCameraContext(
            { x: 100, y: 100 }, // cameraOffset
            1.5,                 // zoom
            600,                // canvasWidth
            400,                // canvasHeight
            2000,               // mapWidth
            2000                // mapHeight
        );
        // viewportWidth = 600/1.5 = 400. viewportHeight = 400/1.5 = 266.6.
        // Viewport rect in game space: x in [100, 500], y in [100, 366.6]
        // Center: (300, 233.3)
        // Check sound inside viewport:
        expect(audioManager.calculateSpatialVolume(200, 200)).toBe(1.0);
    });

    it('returns 0.15 when sound is extremely far away', () => {
        audioManager.updateCameraContext(
            { x: 100, y: 100 },
            1.0,
            200,
            200,
            2000,
            2000
        );
        // viewportWidth = 200, viewportHeight = 200
        // Viewport rect: x in [100, 300], y in [100, 300]
        // Center: (200, 200)
        // Sound extremely far away (e.g. opposite side of torus map):
        expect(audioManager.calculateSpatialVolume(1200, 1200)).toBe(0.15);
    });

    it('returns between 0.15 and 1.0 when sound is just outside the viewport edge', () => {
        audioManager.updateCameraContext(
            { x: 100, y: 100 },
            1.0,
            200,
            200,
            2000,
            2000
        );
        // viewportWidth = 200, viewportHeight = 200
        // Viewport rect: x in [100, 300], y in [100, 300]
        // Center: (200, 200)
        // Sound at x = 400, y = 200 (distance from edge distX = 100, distY = 0 -> distFromEdge = 100)
        // falloffFactor = 1 - 100/1000 = 0.9
        // volumeMultiplier = 0.15 + 0.85 * 0.9 = 0.915
        expect(audioManager.calculateSpatialVolume(400, 200)).toBeCloseTo(0.915);
    });
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run client/src/utils/AudioManager.test.js`
Expected: FAIL due to missing functions `updateCameraContext` and `calculateSpatialVolume`.

**Step 3: Write minimal implementation**
Implement the context state, the `updateCameraContext` method, and the `calculateSpatialVolume` math in `client/src/utils/AudioManager.js`:

```javascript
class AudioManager {
    constructor() {
        // ... existing props ...
        this.cameraContext = null;
    }
    
    updateCameraContext(cameraOffset, zoom, canvasW, canvasH, mapW, mapH) {
        this.cameraContext = { cameraOffset, zoom, canvasW, canvasH, mapW, mapH };
    }

    calculateSpatialVolume(soundX, soundY) {
        if (!this.cameraContext || soundX === undefined || soundY === undefined) {
            return 1.0;
        }

        const { cameraOffset, zoom, canvasW, canvasH, mapW, mapH } = this.cameraContext;
        
        const viewportWidth = canvasW / zoom;
        const viewportHeight = canvasH / zoom;

        const cx = cameraOffset.x + viewportWidth / 2;
        const cy = cameraOffset.y + viewportHeight / 2;

        let dx = soundX - cx;
        let dy = soundY - cy;
        if (dx > mapW / 2) dx -= mapW;
        if (dx < -mapW / 2) dx += mapW;
        if (dy > mapH / 2) dy -= mapH;
        if (dy < -mapH / 2) dy += mapH;

        const inViewport = Math.abs(dx) <= viewportWidth / 2 && Math.abs(dy) <= viewportHeight / 2;
        if (inViewport) {
            return 1.0;
        }

        const distX = Math.max(0, Math.abs(dx) - viewportWidth / 2);
        const distY = Math.max(0, Math.abs(dy) - viewportHeight / 2);
        const distFromEdge = Math.sqrt(distX * distX + distY * distY);

        const maxFalloffDistance = 1000;
        const minFloor = 0.15;
        
        const falloffFactor = Math.max(0, 1 - distFromEdge / maxFalloffDistance);
        return minFloor + (1.0 - minFloor) * falloffFactor;
    }
}
```

**Step 4: Run test to verify it passes**
Run: `npx vitest run client/src/utils/AudioManager.test.js`
Expected: PASS.

**Step 5: Commit**
```bash
git add client/src/utils/AudioManager.js client/src/utils/AudioManager.test.js
git commit -m "feat(audio): add camera context and spatial volume calculation to AudioManager"
```

---

### Task 2: Integrate Spatial Calculations into `playSfx` and Specific Sound Methods

**Files:**
- Modify: `client/src/utils/AudioManager.js`
- Modify: `client/src/utils/AudioManager.test.js`

**Step 1: Write the failing test**
Add tests to verify that `playSfx` respects coordinates `(soundX, soundY)` and applies the calculated volume multiplier to the ZzFX playback parameters:

```javascript
it('applies spatial volume multiplier to zzfx playback parameters', async () => {
    const mockCompressor = {
        threshold: { setValueAtTime: vi.fn() },
        knee: { setValueAtTime: vi.fn() },
        ratio: { setValueAtTime: vi.fn() },
        attack: { setValueAtTime: vi.fn() },
        release: { setValueAtTime: vi.fn() },
        connect: vi.fn()
    };
    const mockContext = {
        state: 'running',
        currentTime: 0,
        resume: vi.fn().mockResolvedValue(),
        createDynamicsCompressor: vi.fn().mockReturnValue(mockCompressor),
        destination: {}
    };
    vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => mockContext));
    const zzfxSpy = vi.spyOn(ZzFXModule, 'zzfx').mockReturnValue(null);

    await audioManager.init();

    // Set camera context and make the sound far away so volume multiplier is 0.15
    audioManager.updateCameraContext(
        { x: 100, y: 100 },
        1.0,
        200,
        200,
        2000,
        2000
    );

    // Default sfx volume in playShoot is 0.2. Global audioManager.volume is 0.5.
    // Far away spatial volume multiplier is 0.15.
    // Final volume = 0.2 * 0.5 * 0.15 = 0.015.
    await audioManager.playShoot(1200, 1200);
    
    expect(zzfxSpy).toHaveBeenCalledWith(
        expect.closeTo(0.015), // final volume parameter
        0.05, 400, .05, undefined, .1, undefined, undefined, 50, -500
    );
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run client/src/utils/AudioManager.test.js`
Expected: FAIL since `playSfx` does not yet accept or apply spatial coordinates.

**Step 3: Write minimal implementation**
1. Modify `playSfx(params, soundX, soundY)` to accept and apply the dynamic spatial multiplier:
```javascript
playSfx(params, soundX, soundY) {
    if (this.isMuted) return null;

    const soundKey = params.join(',');
    if (this.frameSounds.has(soundKey)) {
        return Promise.resolve(null);
    }
    this.frameSounds.add(soundKey);
    if (this.frameSounds.size === 1) {
        setTimeout(() => {
            this.frameSounds.clear();
        }, 0);
    }

    return this.init().then(() => {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        
        const spatialMultiplier = this.calculateSpatialVolume(soundX, soundY);

        const finalParams = [...params];
        finalParams[0] = (finalParams[0] === undefined ? 1 : finalParams[0]) * this.volume * spatialMultiplier;
        return zzfx(...finalParams);
    }).catch((err) => {
        console.error('Failed playing SFX:', err);
        return null;
    });
}
```

2. Update all positional sound methods in `client/src/utils/AudioManager.js` (e.g. `playShoot`, `playHeavyLaunch`, `playLaser`, `playExplosion`, `playShieldHit`, `playNukeDetonation`, `playLinkSevered`, `playStructureDestroyed`, `playStructureLanding`, `playSamLaunch`, `playSamFlight`, `playSamLockOn`, `playRibbit`, `playCrackle`, `playBwow`, `playDrop`, `playSmallBombDrop`, `playDeathRay`) to accept `(x, y)` parameters and pass them to `playSfx`:
```javascript
playShoot(x, y) {
    return this.playSfx([0.2, 0.05, 400, .05, undefined, .1, undefined, undefined, 50, -500], x, y);
}
```

**Step 4: Run test to verify it passes**
Run: `npx vitest run client/src/utils/AudioManager.test.js`
Expected: PASS.

**Step 5: Commit**
```bash
git add client/src/utils/AudioManager.js client/src/utils/AudioManager.test.js
git commit -m "feat(audio): update playSfx and specific sound methods to accept spatial coordinates"
```

---

### Task 3: Feed Camera Context from GameBoard Rendering Loop

**Files:**
- Modify: `client/src/components/GameBoard.jsx`

**Step 1: Check build/lint of GameBoard**
Before making changes, verify that the project is currently building/running correctly.

**Step 2: Sync camera offset and zoom**
Modify the `updateAndDraw` callback in the main `useEffect` of `client/src/components/GameBoard.jsx`.
Add the `audioManager.updateCameraContext` call:

```javascript
// Around line 175 of GameBoard.jsx:
const cameraOffset = {
    x: isNaN(rawCameraOffset?.x) ? 0 : rawCameraOffset.x,
    y: isNaN(rawCameraOffset?.y) ? 0 : rawCameraOffset.y
};

// Sync latest camera context to AudioManager
audioManager.updateCameraContext(
    cameraOffset,
    zoom,
    canvas.width,
    canvas.height,
    mapW,
    mapH
);
```

Ensure `audioManager` is imported at the top of `client/src/components/GameBoard.jsx`:
```javascript
import { audioManager } from '../utils/AudioManager';
```

**Step 3: Run the project and lint**
Run: `npm run lint`
Expected: PASS with no unresolved imports or syntax errors.

**Step 4: Commit**
```bash
git add client/src/components/GameBoard.jsx
git commit -m "feat(audio): feed camera context from GameBoard rendering loop to AudioManager"
```

---

### Task 4: Propagate Entity Coordinates from Visual Interpolation

**Files:**
- Modify: `client/src/hooks/useVisualInterpolation.js`

**Step 1: Locate and modify all sound calls**
In `client/src/hooks/useVisualInterpolation.js`, locate all calls to `audioManager` play methods inside `updateInterpolation` and pass the entity coordinates `(serverEnt.x, serverEnt.y)` or ghost coordinates `(viz.x, viz.y)` where relevant:

1. Newly spawned entities:
   - Homing missile: `audioManager.playHeavyLaunch(serverEnt.x, serverEnt.y)`
   - SAM/Smart SAM: `audioManager.playSamLaunch(serverEnt.x, serverEnt.y)`
   - Other projectiles: `audioManager.playShoot(serverEnt.x, serverEnt.y)`
   - Laser beam: `audioManager.playLaser(serverEnt.x, serverEnt.y)`
   - Nuke: `audioManager.playNukeDetonation(serverEnt.x, serverEnt.y)`
   - Other explosions: `audioManager.playExplosion(serverEnt.x, serverEnt.y)`
   - Shield hit/collision/spark: `audioManager.playShieldHit(serverEnt.x, serverEnt.y)`
   - Structure landing: `audioManager.playStructureLanding(serverEnt.x, serverEnt.y)`

2. Structure hp reduction:
   - Shield hit: `audioManager.playShieldHit(serverEnt.x, serverEnt.y)`

3. Homing/SAM missile lock on:
   - Lock on: `audioManager.playSamLockOn(serverEnt.x, serverEnt.y)`

4. Structure destruction (ghost handling):
   - Destroyed: `audioManager.playStructureDestroyed(viz.x, viz.y)`

5. Link severed (ghost handling):
   - Link severed: `audioManager.playLinkSevered(from.x, from.y)` (using source entity position)

**Step 2: Run tests and lint**
Run: `npx vitest run` and `npm run lint`
Expected: All tests and linters PASS.

**Step 3: Commit**
```bash
git add client/src/hooks/useVisualInterpolation.js
git commit -m "feat(audio): propagate coordinates to all AudioManager calls in visual interpolation"
```
