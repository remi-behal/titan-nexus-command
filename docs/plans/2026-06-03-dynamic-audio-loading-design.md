# Dynamic Audio Loading Design

## Objective
Enable `AudioManager` to dynamically load and register procedural sound effects defined in `zzfx_sounds.json` as direct methods on the `AudioManager` class instance. This makes `zzfx_sounds.json` the single source of truth for all procedural sounds (including the original game sounds and newer additions), and allows the `debug-audio.html` control deck to automatically present buttons for all loaded sounds.

## Design Details

### 1. Sound Source of Truth: `zzfx_sounds.json`
All procedural sounds, including the original 18 sound effects and newer custom additions, are stored in `client/src/utils/zzfx_sounds.json`.

### 2. Dynamic Method Generation in `AudioManager.js`
- `AudioManager` imports `zzfx_sounds.json` statically.
- At construction time, `AudioManager` parses each sound in `zzfx_sounds.json`, converts its name to a standard camelCase methodName (e.g. "Round Start" -> "playRoundStart"), and binds a dynamic function to `this[methodName]` calling `this.playSfx(params, x, y)`.
- Explicit, duplicate static methods are deleted from `AudioManager.js` to ensure zero redundancy.
- `playHeavyErrorCombo` remains as a static class method due to its custom orchestration logic.

### 3. Dynamic Button Rendering in `debug-audio.html`
- `debug-audio.html` retrieves the list of loaded sounds via `audioManager.getRegisteredSounds()`.
- The SFX grid is populated dynamically from this list, displaying every registered sound with clean index numbers.

### 4. Tests
- `AudioManager.test.js` is updated to verify that procedural sounds are correctly registered and play successfully.
