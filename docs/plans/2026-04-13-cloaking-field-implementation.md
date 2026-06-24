# Cloaking Field Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Implement a new `CLOAKING_FIELD` structure that hides friendly units within a 300px radius from enemy vision and homing missiles.

**Architecture:** 
1.  **State**: Add `CLOAKING_FIELD` to `EntityStats.js`.
2.  **Engine**: Update `GameState.getVisibleState` for dynamic visibility filtering (O(n) check for cloak fields per entity). Updated `updateSeekerProjectile` for homing immunity.
3.  **UI**: Canvas displacement/noise effect in `GameBoard.jsx` for the shimmer.

**Tech Stack:** JavaScript (Shared/Engine), React/Canvas (Client).

---

### Task 1: Constants & State
**Files:**
- Modify: `shared/constants/EntityStats.js`

**Step 1: Define `CLOAKING_FIELD` stats**
```javascript
    CLOAKING_FIELD: {
        hp: 2,
        cost: 60,
        vision: 150,
        cloakRange: 300,
        detectionRange: 25,
        size: 20,
        speed: SPEED_TIERS.SLOW,
        deathEffect: 'DISINTEGRATE'
    },
```

**Step 2: Commit**
```bash
git add shared/constants/EntityStats.js
git commit -m "feat: add CLOAKING_FIELD constants"
```

---

### Task 2: Simulation Logic (Visibility Filtering)
**Files:**
- Modify: `shared/GameState.js`
- Test: `shared/tests/CloakingVisibility.test.js`

**Step 1: Write failing test for Cloaking Visibility**
- Verify that an enemy structure within 300px of a Cloaking Field is NOT returned in `getVisibleState` unless a scout is within `detectionRange`.

**Step 2: Implement visibility override in `isPositionVisible` or `getVisibleState`**
- In `isPositionVisible`, if the target coordinate `(x, y)` is within `stat.cloakRange` of a non-disabled `CLOAKING_FIELD` owned by the target player, only return `true` if `dist <= detectionRange`.

**Step 3: Run tests and verify PASS**
Run: `npx vitest shared/tests/CloakingVisibility.test.js`

**Step 4: Commit**
```bash
git add shared/GameState.js shared/tests/CloakingVisibility.test.js
git commit -m "feat: implement cloaking visibility filtering"
```

---

### Task 3: Simulation Logic (Homing Immunity)
**Files:**
- Modify: `shared/GameState.js`
- Test: `shared/tests/CloakingHoming.test.js`

**Step 1: Write failing test for Homing Immunity**
- Verify `updateSeekerProjectile` skips cloaked entities in its search phase.

**Step 2: Update `updateSeekerProjectile`**
- Add check: `if (isCloaked(target)) continue;` (using a helper shared with visibility logic).

**Step 3: Run tests and verify PASS**

**Step 4: Commit**
```bash
git add shared/GameState.js shared/tests/CloakingHoming.test.js
git commit -m "feat: implement homing missile immunity for cloaked structures"
```

---

### Task 4: Client Visuals (Shimmer Effect)
**Files:**
- Modify: `client/src/components/GameBoard.jsx`
- Modify: `client/src/constants/VisualStats.js`

**Step 1: Add Cloaking Visual Stats**
- Add `SHIMMER_FREQUENCY: 5000` (5 seconds) and `SHIMMER_DURATION: 500` to `VisualStats.js`.

**Step 2: Implement Shimmer in `GameBoard.jsx`**
- In the rendering loop, for each `CLOAKING_FIELD` entity:
    - If owned, draw a clear circle.
    - If enemy, using `(Date.now() % 5000 < 500)`, apply a slight canvas displacement (using `ctx.save()`, `ctx.translate`, etc.) or a faint noise pattern in the 300px radius.

**Step 3: Manual Verification**
- Deploy a Cloaking Field and observe the shimmer effect and correctly hidden structures.

**Step 4: Commit**
```bash
git add client/src/components/GameBoard.jsx client/src/constants/VisualStats.js
git commit -m "feat: implement intermittent shimmer effect for cloaking field"
```
