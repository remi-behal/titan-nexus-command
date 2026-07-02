# Wind Weather System Design Document

**Goal**: Implement a periodic wind storm mechanic that drifts all launched items (projectiles and structures) during flight, with full visual feedback in the UI (wind HUD compass and canvas drifting particles).

## 1. State Representation & Storm Scheduling

We will store the current wind state in `shared/GameState.js` so it remains synchronized between server and clients.

### Game State Schema
```javascript
this.windState = {
    active: false,
    angle: 0,        // Direction in degrees (0 to 359)
    speed: 0,        // Wind force (drift in pixels per sub-tick)
    duration: 0,     // Remaining turns for current storm
    cooldown: 12     // Turns remaining until the next storm
};
```

### Map Config Modification
The wind cycle will be toggleable based on a map modifier in the map definition:
```javascript
map.modifiers = {
    windEnabled: true
};
```
If `windEnabled` is falsy, wind remains inactive and cooldown is ignored.

### Storm Cycle Logic
At the beginning of turn resolution (`resolveTurn` in `GameState.js`), `updateWindCycle()` will be executed:
1. **Storm Active**:
   * Decrement `duration`.
   * If `duration === 0`, set `active = false`, reset `speed = 0`, and randomize `cooldown = random(10, 15)`.
2. **Storm Inactive**:
   * Decrement `cooldown`.
   * If `cooldown === 0`, set `active = true`, randomize `duration = random(3, 6)`, randomize `angle = random(0, 360)`, and set `speed = random(0.5, 1.5)`.

---

## 2. Physics-Based Drift Simulation

We will apply the wind vector to projectile coordinates during the sub-tick resolution phase in `shared/systems/ProjectileSystem.js`.

### Standard Projectiles (Kinetic Bombs, Launched Structures, etc.)
Standard projectiles follow a linear trajectory calculated as:
```javascript
const progress = t / proj.arrivalTick;
```
If wind is active:
* **During Flight (`t < arrivalTick`)**:
  ```javascript
  const windX = gameState.windState.dx * t;
  const windY = gameState.windState.dy * t;
  proj.currX = TorusMath.wrapX(proj.startX + proj.intendedDx * progress + windX, gameState.map.width);
  proj.currY = TorusMath.wrapY(proj.startY + proj.intendedDy * progress + windY, gameState.map.height);
  ```
* **At Landing (`t === arrivalTick`)**:
  ```javascript
  const windX = gameState.windState.dx * proj.arrivalTick;
  const windY = gameState.windState.dy * proj.arrivalTick;
  proj.currX = TorusMath.wrapX(proj.startX + proj.intendedDx + windX, gameState.map.width);
  proj.currY = TorusMath.wrapY(proj.startY + proj.intendedDy + windY, gameState.map.height);
  ```

### Seeker Projectiles (Homing Missiles, SAM Interceptors)
Guided projectiles steer dynamically. We apply a flat wind vector per sub-tick:
```javascript
const windX = gameState.windState.dx;
const windY = gameState.windState.dy;
proj.currX = TorusMath.wrapX(proj.currX + Math.cos(rad) * moveDist + windX, gameState.map.width);
proj.currY = TorusMath.wrapY(proj.currY + Math.sin(rad) * moveDist + windY, gameState.map.height);
```
Since seeker target tracking is calculated dynamically in the next sub-tick relative to `proj.currX`/`proj.currY`, guided missiles will naturally steer against the wind drift, resulting in natural curved paths.

---

## 3. Client HUD & Visual Presentation

The client will display wind state synchronizations sent from the server.

### UI Wind Indicator (HUD)
We will add a clean visual indicator to `client/src/components/HUD/SidebarLeft.jsx` or as a top bar overlay in `client/src/App.jsx`:
* An arrow or compass indicating wind direction (`windState.angle`).
* A speed readout showing wind speed (e.g., `METHANE GUST: 8.5 m/s` based on `windState.speed`).
* Warning status when a storm is active.

### Canvas Wind Particle Overlay
To visually communicate the wind, `client/src/components/GameBoard.jsx` (or a sub-renderer) will render drifting streaks:
* Maintain an array of particle positions.
* Move particles across the screen using the current wind angle and speed.
* Wrap particles around the screen viewport when they exit.
* Render them as thin, semi-transparent white/blue lines to give the look of drifting methane clouds.
