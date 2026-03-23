# Nuke Weapon Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Implement a high-risk, high-reward "Nuke" structure that explodes after 2 turns for massive area damage.

**Architecture:** 
- **Stats**: Centralized in `EntityStats.js`.
- **Logic**: Nuke is a structure with a `detonationTurn` property. Explosion logic extracted in `GameState.js` and triggered at the start of `resolveTurn`.
- **UI**: Hexagonal rendering and countdown badge in `GameBoard.jsx`.

**Tech Stack:** JavaScript (Shared Engine), React + HTML5 Canvas (Frontend).

---

### Task 1: Define NUKE Stats
**Files:**
- Modify: `shared/constants/EntityStats.js`(file:///home/behalr/titan-nexus-command/shared/constants/EntityStats.js)

**Step 1: Add NUKE to ENTITY_STATS**
Add the following statistics:
```javascript
    NUKE: {
        hp: 5,
        cost: 100,
        damageFull: 10,
        radiusFull: 200,
        damageHalf: 5,
        radiusHalf: 400,
        vision: 200,
        size: 25,
        speed: SPEED_TIERS.SLOW,
        deathEffect: 'DISINTEGRATE' // Silent death if destroyed early
    },
```

**Step 2: Commit**
```bash
git add shared/constants/EntityStats.js
git commit -m "feat: add Nuke weapon statistics"
```

---

### Task 2: Refactor Explosion Logic in GameState
**Files:**
- Modify: `shared/GameState.js`(file:///home/behalr/titan-nexus-command/shared/GameState.js)

**Step 1: Extract `triggerExplosion` helper**
Create a new method `triggerExplosion(x, y, stats, tempVisuals = [], impacts = new Set())` that encapsulates the AOE damage calculation and visual effect creation currently inside the sub-tick loop.

**Step 2: Update existing explosion calls**
Replace the inline explosion logic in `resolveTurn` (around line 1000) with a call to `this.triggerExplosion(...)`.

**Step 3: Commit**
```bash
git add shared/GameState.js
git commit -m "refactor: extract reusable explosion logic in GameState"
```

---

### Task 3: Implement Nuke Lifecycle & Detonation
**Files:**
- Modify: `shared/GameState.js`(file:///home/behalr/titan-nexus-command/shared/GameState.js)

**Step 1: Set `detonationTurn` in `addEntity`**
When adding a `NUKE`, initialize `detonationTurn: this.turn + 2`.

**Step 2: Hook Detonation in `resolveTurn`**
At the beginning of `resolveTurn` (after energy generation), iterate through `this.entities`. If `e.type === 'NUKE'` and `e.detonationTurn <= this.turn`, call `this.triggerExplosion` and add the Nuke to `impacts` to be removed.

**Step 3: Verify with minimal console logs**
Run: `npm test shared/tests/GameState.test.js` (to ensure no regressions).

**Step 4: Commit**
```bash
git add shared/GameState.js
git commit -m "feat: implement Nuke detonation and lifecycle logic"
```

---

### Task 4: Implement Nuke Visuals
**Files:**
- Modify: `client/src/components/GameBoard.jsx`(file:///home/behalr/titan-nexus-command/client/src/components/GameBoard.jsx)

**Step 1: Add Hexagonal Rendering for Nuke**
Inside the entity rendering loop, add a case for `entity.type === 'NUKE'`.
- Draw a hexagon using `ctx.moveTo/lineTo`.
- Add a flickering/pulsing red center.

**Step 2: Add Countdown Badge**
For Nuke entities, calculate `remainingTurns = entity.detonationTurn - currentTurn`.
Draw a small circular badge above the structure with the number of turns remaining.

**Step 3: Commit**
```bash
git add client/src/components/GameBoard.jsx
git commit -m "feat: add hexagonal rendering and countdown for Nuke"
```

---

### Task 5: Verification Test
**Files:**
- Create: `shared/tests/Nuke.test.js`

**Step 1: Write the failing test**
Create a test that:
1. Initializes a game.
2. Submits an action to launch a NUKE.
3. Resolves Turn 1 (Check land/deploy).
4. Resolves Turn 2 (Verify it exists).
5. Resolves Turn 3 (Verify it explodes and damages a nearby Hub).
6. Verify "Defuse" case: Destroying it on Turn 2 results in no explosion.

**Step 2: Run test to verify it passes**
Run: `npx vitest shared/tests/Nuke.test.js`
Expected: PASS

**Step 3: Commit**
```bash
git add shared/tests/Nuke.test.js
git commit -m "test: add comprehensive Nuke behavioral tests"
```

## Verification Plan

### Automated Tests
- `npx vitest shared/tests/Nuke.test.js`
- `npx vitest shared/tests/GameState.test.js`

### Manual Verification
1. Launch `npm run dev`.
2. Open two tabs.
3. Save up 100 energy.
4. Launch a Nuke near an enemy Hub.
5. Watch the 2-turn countdown.
6. Verify the explosion occurs and the Hub's health is depleted.
7. Repeat, but try to destroy the Nuke with a laser or bomb before Turn 3.
