# Design: SAM Missile Procedural Audio Systems

This document defines the technical design, chiptune synthesis parameters, and system-wide integration architecture for the SAM Missile (surface-to-air interceptor) audio experience in *Titan: Nexus Command*.

- **Author**: Antigravity AI
- **Date**: 2026-05-25
- **Status**: APPROVED

---

## 1. Objectives & Scope
The objective is to implement three high-fidelity procedural chiptune sound effects for both `SAM_MISSILE` and `SMART_SAM_MISSILE` systems using the lightweight `ZzFX` synthesis library:
1. **SAM Launch**: Play a heavy pneumatic pop immediately followed by a rising pitch sweep when the interceptor leaves its launcher.
2. **SAM Flight**: Play a periodic soft low-frequency thruster pulse while the missile is flying in the air.
3. **SAM Lock On**: Play a sharp dual-tone cybernetic alert ping the instant the interceptor locks onto a target projectile.

Both missile types will share this unified audio profile to ensure crisp gameplay feedback and rapid tactical recognition.

---

## 2. ZzFX Sound Calibration Parameters
The following chiptune parameters are configured to match the established aesthetic values in `AudioManager.js`:

### 2.1. Launch (`playSamLaunch`)
- **Profile**: Heavy mechanical pop + sweeping chiptune whistle.
- **ZzFX Parameter Set**: `[0.35, undefined, 180, 0.05, 0.05, 0.2, undefined, 1.2, undefined, 10, undefined, undefined, undefined, 200, 0.02]`

### 2.2. Flight (`playSamFlight`)
- **Profile**: Soft, low-frequency, slightly noisy thruster pulse.
- **ZzFX Parameter Set**: `[0.08, undefined, 75, 0.04, undefined, 0.08, undefined, 0.5, undefined, -15]`

### 2.3. Lock On (`playSamLockOn`)
- **Profile**: Dual-tone high-frequency alert sweep.
- **ZzFX Parameter Set**: `[0.22, undefined, 950, 0.01, 0.03, 0.08, 1, 1.8, undefined, 10, 300, 0.02, 0.05]`

---

## 3. Integration Architecture

### 3.1. AudioManager Interface (`AudioManager.js`)
We will add three new methods to the `AudioManager` class:
```javascript
playSamLaunch() {
    this.playSfx([0.35, undefined, 180, 0.05, 0.05, 0.2, undefined, 1.2, undefined, 10, undefined, undefined, undefined, 200, 0.02]);
}

playSamFlight() {
    this.playSfx([0.08, undefined, 75, 0.04, undefined, 0.08, undefined, 0.5, undefined, -15]);
}

playSamLockOn() {
    this.playSfx([0.22, undefined, 950, 0.01, 0.03, 0.08, 1, 1.8, undefined, 10, 300, 0.02, 0.05]);
}
```

### 3.2. Rendering Simulation Hooks (`GameBoard.jsx`)

#### A. Launch Detection
Under `GameBoard`'s new entity spawn detector, we identify incoming projectiles:
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

#### B. Flight Pulsing Loop
To avoid filling memory with endless plays, we use a simple temporal pulse loop.
For every entity currently in flight:
- We check if `(Date.now() - (entity.lastFlightSoundTime || 0)) > 150ms`.
- If true, call `audioManager.playSamFlight()` and update `entity.lastFlightSoundTime = Date.now()`.
This keeps the flight rumble perfectly metered and avoids high volume saturation.

#### C. Lock-On Detection
When updating visual entity properties:
```javascript
const viz = visualEntities.current[serverEnt.id];
const prevLockFound = viz.lockFound;
viz.lockFound = serverEnt.lockFound;

if (viz.lockFound && !prevLockFound) {
    audioManager.playSamLockOn();
}
```

### 3.3. Test & Calibration Panel (`debug-audio.html`)
We will extend `debug-audio.html`'s ZzFX grid to include three interactive buttons:
```html
<button class="sfx-btn" data-sfx="samLaunch">
    <span>16. SAM LAUNCH</span>
    <span class="btn-desc">Mechanical pop and rising whistle</span>
</button>
<button class="sfx-btn" data-sfx="samFlight">
    <span>17. SAM FLIGHT</span>
    <span class="btn-desc">Pulsed rocket engine thruster rumble</span>
</button>
<button class="sfx-btn green" data-sfx="samLock">
    <span>18. SAM LOCK ON</span>
    <span class="btn-desc">Dual-tone cybernetic target lock chime</span>
</button>
```

---

## 4. Verification Procedures
1. Run local development server (`npm run dev`).
2. Navigate to `http://localhost:3000/debug-audio.html` (or appropriate port).
3. Confirm that the three new diagnostic buttons trigger the procedural sounds perfectly and show visualizer waves.
4. Run integration tests (`npm run test`) to verify no regressions occur in simulation loop or entity parameters.
