# Spatial Dynamic Audio System Design

## Goal Description
Implement a spatial dynamic audio system where sound volumes are adjusted dynamically based on where they occur relative to the player's viewport.
- **Inside Map View (Viewport)**: Sounds play at `1.0` (full volume), even if hidden under the fog of war.
- **Outside Map View (Viewport)**: Sounds play at a reduced volume based on their toroidal distance from the viewport boundary, down to a minimum floor of `15%` (`0.15`) volume.

This enables players to glean crucial scouting information (e.g., enemy weapons firing or exploding) from sound alone.

---

## Spatial Audio Math Design

### 1. Viewport Coordinates in Game Units
The viewport's boundaries in game coordinates are computed using the current camera offset, zoom factor, and canvas dimensions:
- `viewportWidth = canvasW / zoom`
- `viewportHeight = canvasH / zoom`
- Viewport center:
  - `cx = cameraOffset.x + viewportWidth / 2`
  - `cy = cameraOffset.y + viewportHeight / 2`

### 2. Toroidal Vector to Sound
Since the map wraps toroidally, the shortest distance vector `(dx, dy)` from the viewport center `(cx, cy)` to the sound source `(soundX, soundY)` is calculated as:
- `dx = soundX - cx`
- `dy = soundY - cy`
- If `dx > mapW / 2`, then `dx -= mapW`
- If `dx < -mapW / 2`, then `dx += mapW`
- If `dy > mapH / 2`, then `dy -= mapH`
- If `dy < -mapH / 2`, then `dy += mapH`

### 3. Viewport Containment Check
The sound is inside the viewport if its closest toroidal instance lies within the half-width and half-height of the viewport box:
- `inViewport = Math.abs(dx) <= viewportWidth / 2 && Math.abs(dy) <= viewportHeight / 2`
- If `inViewport` is true, the `volumeMultiplier = 1.0` (Full volume).

### 4. Distance Falloff Outside Viewport
If the sound is outside the viewport, we calculate the Euclidean distance from the viewport's bounding box edges:
- `distX = Math.max(0, Math.abs(dx) - viewportWidth / 2)`
- `distY = Math.max(0, Math.abs(dy) - viewportHeight / 2)`
- `distFromEdge = Math.sqrt(distX * distX + distY * distY)`

We then apply a linear falloff over a maximum distance threshold of `maxFalloffDistance = 1000` (half the map width) down to a minimum floor of `15%` volume:
- `falloffFactor = Math.max(0, 1 - distFromEdge / maxFalloffDistance)`
- `volumeMultiplier = 0.15 + 0.85 * falloffFactor`

---

## Proposed Changes

### Component 1: `client/src/utils/AudioManager.js`
- Add `cameraContext` state variable to hold `cameraOffset`, `zoom`, `canvasW`, `canvasH`, `mapW`, `mapH`.
- Add `updateCameraContext(cameraOffset, zoom, canvasW, canvasH, mapW, mapH)`.
- Add `calculateSpatialVolume(soundX, soundY)` implementing the spatial math above.
- Update `playSfx(params, soundX, soundY)` to calculate and apply the spatial volume multiplier onto the final parameters.
- Update all specific sfx playback methods (e.g. `playShoot`, `playExplosion`, `playSamLaunch`, etc.) to accept `(x, y)` parameters and pass them to `playSfx`.

### Component 2: `client/src/components/GameBoard.jsx`
- In the main canvas rendering `useEffect` loop, sync the latest camera and viewport parameters to the `audioManager` by calling `audioManager.updateCameraContext(...)` every frame.

### Component 3: `client/src/hooks/useVisualInterpolation.js`
- In the entity updates loop, pass the entity's `(x, y)` coordinates to each `audioManager` playback call (e.g., `playShoot(serverEnt.x, serverEnt.y)`, `playExplosion(serverEnt.x, serverEnt.y)`).

---

## Verification Plan

### Manual Verification
- Pan camera away from structures/projectiles and verify that explosions/launches are quieter.
- Position the camera directly over fog-of-war areas where action is happening, and verify that sounds play at full volume even though the entities themselves are not visible.
- Pan/scroll quickly during projectile flight to verify the smooth transition/falloff of volume in real time.
