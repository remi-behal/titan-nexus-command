# Design Document: Interactive Planning & UI Sound Effects

**Date**: 2026-05-22  
**Topic**: Interactive UI & Planning SFX  
**Status**: APPROVED

---

## 1. Goal Description

Expand the procedural audio coverage of Titan: Nexus Command by implementing interactive planning and user interface sound effects. These sounds provide critical game feel and tactile feedback when players navigate menus, select outposts, stage cable links, commit turns, claim multiplayer seats, or clear staged actions. In addition, a heavy pneumatic orbital landing sound will play when new outposts stabilize on Titan's surface.

---

## 2. Key Constraints & Success Criteria

- **Procedural ZzFX arrays**: Must define lightweight parameter arrays with explicit `undefined` entries to avoid ESLint `no-sparse-arrays` violations.
- **Zero-Latency UI Feedback**: Interactive clicks and selections must play immediately on user input.
- **Visual Landing Sync**: Orbital structure landing slams must be triggered frame-accurately in the visual LERP update loop when new outposts are first spawned.
- **Test Stability**: All new player methods must be unit tested and pass ESLint.

---

## 3. Proposed Architecture

### 3.1. AudioManager.js Extension
We will introduce 7 new play methods to `AudioManager.js`:

```javascript
// client/src/utils/AudioManager.js

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

### 3.2. Integration Plan

#### App.jsx (UI Interactions)
- **Claim Seat**: Inside `handleClaimSeat()`, invoke `audioManager.playSeatClaim()`.
- **Commit/Uplink Turn**: Inside `commitActions()`, invoke `audioManager.playUplink()`.
- **Main buttons**: Invoke `audioManager.playClick()` on key UI actions (Ready checkbox, sub-panels, etc.).

#### GameBoard.jsx (Tactical Planning & Landing)
- **Select Outpost**: Inside `handleCanvasClick()` where selection changes, play `playTerminalSelect()`.
- **Stage Link**: When adding a link to staged actions, play `playLinkStage()`.
- **Clear Staging**: Inside action-clear buttons/routines, play `playActionReset()`.
- **Structure Landing**: Inside the visual update loop, when a new entity is registered: if its type is a base structure (`HUB`, `EXTRACTOR`, `TURRET`, `SHIELD`, `CLOAKING_FIELD`, `RELAY`, `BARRIER`), play `playStructureLanding()`.

---

## 4. Verification Plan

- **Vitest Unit Tests**: Extend `AudioManager.test.js` to assert each new play method triggers the underlying `ZzFX` synth.
- **ESLint Compliance**: Ensure all sparse arrays are coded with explicit `undefined` to guarantee compliance.
- **Manual verification**: Calibrate sounds inside the debug soundboard console (`/debug-audio.html`) and test in-game seat joins, selection chirps, link staging, and structural drops.
