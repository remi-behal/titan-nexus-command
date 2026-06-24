# Slingshot Safety System Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Implement a real-time warning and denial system that prevents players from launching a projectile if the resulting link would cross an existing or staged link originating from the same source hub.

**Architecture:** Add a static validation helper to `GameState.js` for intersection detection. Use this helper in `GameBoard.jsx` for real-time visual warnings and in `App.jsx` to block invalid actions with a "glitch" rejection effect.

**Tech Stack:** React, HTML5 Canvas, Socket.io, Vitest.

---

### Task 1: Shared Logic - Collision Helper
**Files:**
- Modify: `shared/GameState.js`
- Test: `shared/tests/GameState.test.js`

**Step 1: Write failing test**
Add a test case to `shared/tests/GameState.test.js` that checks if a potential link crosses an existing link from the same hub.

**Step 2: Implement `checkLinkIntersection`**
Add a static method to `GameState.js` that:
1. Takes `hub`, `targetX`, `targetY`, `existingLinks`, `stagedActions`, and `map`.
2. Decomposes the new projected link into toroidal segments.
3. Compares them against all links in `existingLinks` and `stagedActions` that share the same `from` hub ID.
4. Returns the first intersection point found, or `null`.

**Step 3: Verify tests pass**
Run `npm test shared/tests/GameState.test.js` and ensure the new logic is correct.

**Step 4: Commit**
`git add shared/GameState.js shared/tests/GameState.test.js && git commit -m "feat: add link intersection validation helper"`

---

### Task 2: UI Warning - GameBoard Integration
**Files:**
- Modify: `client/src/components/GameBoard.jsx`

**Step 1: Implement Real-time Warning**
In `GameBoard.jsx`, within the `isAiming` block of the `updateAndDraw` loop:
1. Call `GameState.checkLinkIntersection` using the current `mousePos`.
2. If an intersection is found, set a local `isBlocked` flag and store the `intersectionPoint`.

**Step 2: Render "LINK CROSSING" Label**
1. If `isBlocked`, draw a text label "LINK CROSSING" in a neon red/white glitchy style **beside the source hub**.
2. (Optional) Draw a small visual indicator (like a red 'X') at the `intersectionPoint`.

**Step 3: Commit**
`git add client/src/components/GameBoard.jsx && git commit -m "feat: add real-time link crossing warning to GameBoard"`

---

### Task 3: Denial Logic - App Integration
**Files:**
- Modify: `client/src/App.jsx`
- Modify: `client/src/App.css`

**Step 1: Update `handleAimEnd`**
In `client/src/App.jsx`:
1. Before adding the action to `committedActions`, run the `GameState.checkLinkIntersection` check.
2. If blocked, do NOT add the action.
3. Instead, trigger a temporary `glitchActive` state (e.g., for 400ms).

**Step 2: Implement Glitch Rejection Animation**
1. Add a CSS class `glitch-rejection` to the main game container when `glitchActive` is true.
2. Add the corresponding keyframe animation to `client/src/App.css` (hue-rotate and slight translate jitter).

**Step 3: Commit**
`git add client/src/App.jsx client/src/App.css && git commit -m "feat: implement launch denial and glitch feedback"`

---

### Task 4: Final Verification
**Verification Plan:**
1. Open the game and select a Hub.
2. Create a link.
3. Aim a second launch that crosses the first link -> Verify "LINK CROSSING" text appears beside the Hub.
4. Release the launch -> Verify no action is added and the screen glitches briefly.
5. Aim a launch that does NOT cross -> Verify it works normally.
6. Verify that links from different Hubs CAN still cross each other.
