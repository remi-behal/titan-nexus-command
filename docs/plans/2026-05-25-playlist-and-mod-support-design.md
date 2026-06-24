# Tracker Music Playlist & `.mod` Support Design Plan

## Overview
This document details the architectural plan to add native `.mod` tracker music support (using the existing WebAssembly-based `chiptune3` player) and integrate a premium in-game track selector to let players toggle background tracks. `twimble.mod` will be configured as the default starting track.

---

## 1. Context & Capabilities
- **Player Capability**: The underlying engine is `chiptune3` which wraps `libopenmpt` compiled to WASM. `libopenmpt` natively sniffs tracker headers (such as `.xm` and `.mod`) and decodes them correctly without code changes.
- **Tracks**:
  - `/audio/tracks/twimble.mod` (Default)
  - `/audio/tracks/hackurr_-_banana.xm`

---

## 2. Component Design & Changes

### 2.1 Game Client Selection (`client/src/App.jsx`)
- **Track List Structure**:
  ```javascript
  const TRACKS = [
      { id: 'twimble', name: 'TWIMBLE.MOD', path: '/audio/tracks/twimble.mod' },
      { id: 'banana', name: 'BANANA.XM', path: '/audio/tracks/hackurr_-_banana.xm' }
  ];
  ```
- **Track Selection State**:
  - Track path state initialized to `/audio/tracks/twimble.mod`.
  - Dynamic user-dropdown styling with CRT-themed borders and standard neon-glow indicators.
  - Interactive swapping logic linked directly to `audioManager.playMusic(path)`.

### 2.2 Diagnostic Control Deck (`client/public/debug-audio.html`)
- **Dynamic Track Swapping**:
  - Replace the hardcoded stream name with a styled `<select>` element.
  - Auto-swapping: A listener on track selection will immediately terminate the playing chiptune instance and stream the new track to prevent audio bleeding.

### 2.3 Audio Manager Integrity (`client/src/utils/AudioManager.js`)
- Keep `AudioManager.js` clean and generic so that its generic `playMusic(trackPath)` accepts any tracker formats (`.xm`, `.mod`, etc.).

---

## 3. Verification Plan
- **Diagnostic Console**: Run Vite dev server, navigate to `/debug-audio.html` inside a browser, and confirm both tracks play seamlessly and change on selection.
- **Unit Testing**: Run Vitest to ensure all sound effect and music playback states remain fully mock-compatible.
