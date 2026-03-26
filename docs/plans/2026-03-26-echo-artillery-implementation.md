# Echo Artillery Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Implement the **Echo Artillery** structure: a reactive, sound-based counter-battery system that fires an inaccurate Dumb Bomb at the source of enemy launches after a 1-round delay.

**Architecture:** Update `GameState.resolveTurn` to track and process reactive firing events within the round loop. Add `ECHO_ARTILLERY` to entity and visual constants.

**Tech Stack:** JavaScript (Shared/Client/Server), React/Canvas (Client).

---

### Task 1: Define Echo Artillery Stats

**Files:**
- Modify: `shared/constants/EntityStats.js`
- Modify: `client/src/constants/VisualStats.js`

**Step 1: Add ECHO_ARTILLERY to EntityStats**
Add the following to `ENTITY_STATS` in `shared/constants/EntityStats.js`:
```javascript
    ECHO_ARTILLERY: {
        hp: 2,
        cost: 30,
        vision: 200,
        size: 20,
        detectionRange: 800,
        isInterceptable: false, // The structure itself isn't, but its shell is
    }
```

**Step 2: Add Visual Stats**
Add to `client/src/constants/VisualStats.js`:
```javascript
    ECHO_ARTILLERY: {
        color: '#808080',
        secondaryColor: '#ff8c00',
    }
```

**Step 3: Commit**
```bash
git add shared/constants/EntityStats.js client/src/constants/VisualStats.js
git commit -m "feat: add Echo Artillery stats and visuals"
```

---

### Task 2: Implement Reactive Trigger Logic

**Files:**
- Modify: `shared/GameState.js`

**Step 1: Track pending echos in resolveTurn**
In `shared/GameState.js`, inside the `resolveTurn`'s round loop:
- Track `pendingEchos` per Echo Artillery (or as a list of events to process in the next round).

**Step 2: Detect enemy launches**
Within the `roundActions.forEach` block, if an enemy `launch` is successful:
- Find all `ECHO_ARTILLERY` belonging to other players within 800px.
- If an artillery hasn't fired this turn, queue a `pendingEcho` for the *next* round.

**Step 3: Commit**
```bash
git add shared/GameState.js
git commit -m "feat: implement Echo Artillery detection and trigger logic"
```

---

### Task 3: Implement Delayed Firing Response

**Files:**
- Modify: `shared/GameState.js`

**Step 1: Process pending echos**
At the start of each round in `resolveTurn`:
- Check for `pendingEchos` from the previous round.
- Generate a `launch` event from the Echo Artillery's coordinates to the detected source.

**Step 2: Add Inaccuracy (Angular Deviation)**
Apply random deviation:
- Angle: `targetAngle + rand(-15, 15)`.
- Power: `targetDistance * (1 + rand(-0.1, 0.1))`.

**Step 3: Commit**
```bash
git add shared/GameState.js
git commit -m "feat: implement Echo Artillery delayed inaccurate fire"
```

---

### Task 4: Verification and Tests

**Files:**
- Create: `shared/tests/EchoArtillery.test.js`

**Step 1: Write verification tests**
Test:
- Detection range (800px).
- 1-round delay firing.
- Once-per-turn limit.
- Sound-based (Fog of War ignorance).
- Accuracy deviation check.

**Step 2: Run tests**
Run: `npm test shared/tests/EchoArtillery.test.js`
Expected: ALL PASS

**Step 3: Commit**
```bash
git add shared/tests/EchoArtillery.test.js
git commit -m "test: add Echo Artillery verification tests"
```
