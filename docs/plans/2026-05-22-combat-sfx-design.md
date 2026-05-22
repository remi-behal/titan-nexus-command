# Design Document: Expanding Procedural Combat & Resolution Sound Effects

**Date**: 2026-05-22  
**Topic**: Combat & Resolution SFX  
**Status**: APPROVED

---

## 1. Goal Description

Expand the audio capabilities of Titan: Nexus Command by implementing a rich, cohesive suite of procedural retro sound effects for combat and tactical resolution phases. By leveraging the existing `ZzFX` synthesis engine, we will introduce specialized sounds for projectile launches, heavy rocket thrusts, point-defense lasers, standard & thermonuclear explosions, shield pings, network link ruptures, and base structure breakdowns. These triggers will be driven directly by visual entity state changes inside the animation and LERP update loops of `GameBoard.jsx`.

---

## 2. Key Constraints & Success Criteria

- **Procedural & Lightweight**: All sound effects must be generated programmatically using `ZzFX` parameter arrays, ensuring a zero-byte addition to static asset downloads.
- **Accurate Timing**: Sounds must be played in immediate sync with client-side LERP rendering of fast-moving items, rather than raw network tick arrivals.
- **Toroidal Safety**: Sounds must not play twice when visual entities wrap around toroidal boundaries or render across multi-tile boundaries.
- **Full Volume & Mute Support**: Sounds must dynamically scale with global volume and mute switches in the audio communication panel.
- **Test Coverage**: All new audio methods must be covered by unit tests in `AudioManager.test.js`.

---

## 3. Proposed Architecture

### 3.1. AudioManager.js Extension
We will introduce 8 procedural synth functions to `AudioManager.js`, each calling `this.playSfx()` with curated parameters.

```javascript
// client/src/utils/AudioManager.js

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

### 3.2. GameBoard.jsx LERP Visual Update Loop Triggers
Triggers will be placed within the LERP visual update loop (which runs once per animation frame *prior* to tiled drawing):

1. **Launches**: When `!visualEntities.current[serverEnt.id]` and the entity is a `PROJECTILE`. Standard versus homing missiles determine standard shoot vs. heavy launch.
2. **Explosions/Hits**: When `!visualEntities.current[serverEnt.id]` and the entity is `EXPLOSION`, `SHIELD_HIT`, `LINK_COLLISION`, or `SPARK`.
3. **Structure Destruction/Damage**:
   - **Damage**: When copying server attributes to visual elements: if `serverEnt.hp < viz.hp`, play `playShieldHit()`.
   - **Destruction**: When pruning dead entities: if a base structure is removed from active state, play `playStructureDestroyed()`.
4. **Link Severing**: When a link ID is pruned from `visualLinks.current` because it is no longer in the server links state.

---

## 4. Verification Plan

### 4.1. Automated Unit Tests
Extend `AudioManager.test.js` to assert:
- `audioManager.playShoot` calls the ZzFX spy.
- `audioManager.playHeavyLaunch` calls the ZzFX spy.
- `audioManager.playLaser` calls the ZzFX spy.
- `audioManager.playExplosion` calls the ZzFX spy.
- `audioManager.playShieldHit` calls the ZzFX spy.
- `audioManager.playNukeDetonation` calls the ZzFX spy.
- `audioManager.playLinkSevered` calls the ZzFX spy.
- `audioManager.playStructureDestroyed` calls the ZzFX spy.

### 4.2. Manual Verification
Run the server and client locally, joint lobbies, launch weapons, sever links, and verify clear, synchronized sound effect synthesis across active browsers.
