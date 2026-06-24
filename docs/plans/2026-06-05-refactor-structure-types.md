# Refactor Structure Types and Centralize Entity Types Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Centralize structure type categorization in `EntityStats.js` via a new `type` property on all entities, completely eliminating the duplicated hardcoded lists and leftover types across the client and server.

**Architecture:** We will declare `ENTITY_TYPES` (STRUCTURE, PROJECTILE, EFFECT) in `shared/constants/EntityStats.js` and annotate every entity entry in `ENTITY_STATS` with its corresponding type. We will then remove leftover legacy structure types (`TURRET`, `BARRIER`, `RELAY`, `WALL`, `SHIELD_GENERATOR`), and refactor all files checking for structure membership to dynamically check `ENTITY_STATS[type]?.type === ENTITY_TYPES.STRUCTURE`.

**Tech Stack:** JavaScript (ES Modules), Vitest for unit testing.

---

### Task 1: Centralize Entity Types in EntityStats.js

**Files:**
- Modify: `shared/constants/EntityStats.js`
- Modify: `shared/constants/ExperimentalStats.js`

**Step 1: Write a test/validation check (simulated via npm run lint)**
We will verify that our configuration updates build and parse correctly.
Run: `npm run lint`
Expected: PASS (with no parser/syntax errors)

**Step 2: Declare ENTITY_TYPES and update ENTITY_STATS**
In `shared/constants/EntityStats.js`, define:
```javascript
export const ENTITY_TYPES = {
    STRUCTURE: 'STRUCTURE',
    PROJECTILE: 'PROJECTILE',
    EFFECT: 'EFFECT'
};
```
Then update every object inside `ENTITY_STATS` to have a `type` property corresponding to its category (e.g., `HUB` gets `type: ENTITY_TYPES.STRUCTURE`, `WEAPON` gets `type: ENTITY_TYPES.PROJECTILE`, `NAPALM_FIRE` gets `type: ENTITY_TYPES.EFFECT`).

For `shared/constants/ExperimentalStats.js`, add `'PROJECTILE'` to `SUPER_BOMB` directly to avoid circular imports:
```javascript
    SUPER_BOMB: {
        type: 'PROJECTILE',
        ...
```

**Step 3: Run the test suite**
Run: `npm test`
Expected: PASS

**Step 4: Commit**
```bash
git add shared/constants/EntityStats.js shared/constants/ExperimentalStats.js
git commit -m "refactor: add type classifications to ENTITY_STATS"
```

---

### Task 2: Refactor GameState.js Structure Checks and Remove Leftovers

**Files:**
- Modify: `shared/GameState.js`

**Step 1: Write/Update the structure classification checks**
In `shared/GameState.js`, import `ENTITY_TYPES`:
```javascript
import { ENTITY_STATS, GLOBAL_STATS, RESOURCE_NODE_STATS, ENTITY_TYPES } from './constants/EntityStats.js';
```
Replace the three hardcoded structure checks with the dynamic check:
- Line 345:
```javascript
const isStructure = ENTITY_STATS[playerEnt.type]?.type === ENTITY_TYPES.STRUCTURE;
```
- Line 362:
```javascript
(e.deployed === false && ENTITY_STATS[e.type]?.type === ENTITY_TYPES.STRUCTURE);
```
- Line 1468:
```javascript
if (t === p.arrivalTick && ENTITY_STATS[p.type]?.type === ENTITY_TYPES.STRUCTURE) {
```

**Step 2: Run the test suite to verify no behavior breaks**
Run: `npm test`
Expected: PASS

**Step 3: Commit**
```bash
git add shared/GameState.js
git commit -m "refactor: replace hardcoded structure checks in GameState with dynamic lookups"
```

---

### Task 3: Refactor useVisualInterpolation.js and Centralize SFX Mapping

**Files:**
- Modify: `client/src/hooks/useVisualInterpolation.js`

**Step 1: Import constants and declare GAME_EVENT_TYPES**
Import `ENTITY_TYPES` and `ENTITY_STATS` from `EntityStats.js`. Declare:
```javascript
export const GAME_EVENT_TYPES = {
    PROJECTILE: 'PROJECTILE',
    LASER_BEAM: 'LASER_BEAM',
    EXPLOSION: 'EXPLOSION',
    SHIELD_HIT: 'SHIELD_HIT',
    LINK_COLLISION: 'LINK_COLLISION',
    SPARK: 'SPARK',
    STRUCTURE_LANDING: 'STRUCTURE_LANDING'
};
```

**Step 2: Implement SPAWN_SFX_MAP and triggerSpawnSfx**
Replace `triggerSpawnSfx` with:
```javascript
const SPAWN_SFX_MAP = {
    [GAME_EVENT_TYPES.PROJECTILE]: (itemType, x, y) => {
        if (itemType === 'HOMING_MISSILE') {
            audioManager.playHeavyLaunch(x, y);
        } else if (itemType === 'SAM_MISSILE' || itemType === 'SMART_SAM_MISSILE') {
            audioManager.playSamLaunch(x, y);
        } else {
            const isStructure = ENTITY_STATS[itemType]?.type === ENTITY_TYPES.STRUCTURE;
            if (!isStructure) {
                audioManager.playShoot(x, y);
            }
        }
    },
    [GAME_EVENT_TYPES.LASER_BEAM]: (itemType, x, y) => audioManager.playLaser(x, y),
    [GAME_EVENT_TYPES.EXPLOSION]: (itemType, x, y) => {
        if (itemType === 'NUKE') {
            audioManager.playNukeDetonation(x, y);
        } else {
            audioManager.playExplosion(x, y);
        }
    },
    [GAME_EVENT_TYPES.SHIELD_HIT]: (itemType, x, y) => audioManager.playShieldHit(x, y),
    [GAME_EVENT_TYPES.LINK_COLLISION]: (itemType, x, y) => audioManager.playShieldHit(x, y),
    [GAME_EVENT_TYPES.SPARK]: (itemType, x, y) => audioManager.playShieldHit(x, y),
    [GAME_EVENT_TYPES.STRUCTURE_LANDING]: (itemType, x, y) => audioManager.playStructureLanding(x, y),
};

const triggerSpawnSfx = (type, itemType, x, y) => {
    const playSfx = SPAWN_SFX_MAP[type];
    if (playSfx) {
        playSfx(itemType, x, y);
    } else if (ENTITY_STATS[type]?.type === ENTITY_TYPES.STRUCTURE) {
        audioManager.playStructureLanding(x, y);
    }
};
```

**Step 3: Update structure destruction sound check**
Replace the hardcoded `STRUCTURE_TYPES` list on lines 177-185:
```javascript
        Object.keys(visualEntities.current).forEach((id) => {
            if (!serverIds.has(id)) {
                const viz = visualEntities.current[id];
                const isStructure = ENTITY_STATS[viz.type]?.type === ENTITY_TYPES.STRUCTURE;
                
                if (isStructure) {
                    if (viz.scouted !== false && !viz.isGhost) {
                        audioManager.playStructureDestroyed(viz.x, viz.y);
                    }
                }
```

**Step 4: Run the test suite**
Run: `npm test`
Expected: PASS

**Step 5: Commit**
```bash
git add client/src/hooks/useVisualInterpolation.js
git commit -m "refactor: simplify useVisualInterpolation SFX triggers using SPAWN_SFX_MAP"
```

---

### Task 4: Refactor EntityRenderer.js and ShapeDefinitions.js

**Files:**
- Modify: `client/src/components/canvas/EntityRenderer.js`
- Modify: `client/src/constants/ShapeDefinitions.js`

**Step 1: Update EntityRenderer.js structure checking**
Import `ENTITY_TYPES` from `EntityStats.js`.
Replace the hardcoded structure check (lines 386-395):
```javascript
                                } else if (ENTITY_STATS[entity.type]?.type === ENTITY_TYPES.STRUCTURE) {
```

**Step 2: Clean up unused shape configurations in ShapeDefinitions.js**
Remove the `TURRET`, `BARRIER`, and `RELAY` keys from `SHAPES` in `client/src/constants/ShapeDefinitions.js`.

**Step 3: Run the test suite and verify UI/render builds**
Run: `npm run lint` && `npm test`
Expected: PASS

**Step 4: Commit**
```bash
git add client/src/components/canvas/EntityRenderer.js client/src/constants/ShapeDefinitions.js
git commit -m "refactor: clean up entity renderer and remove leftover shape definitions"
```
