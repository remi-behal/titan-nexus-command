# Map Panning During Resolution Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Allow players to pan the map during the execution phase while blocking hub selection and aiming.

**Architecture:** Remove CSS pointer-event restriction and implement logic guards in the GameBoard component to filter interactions based on the resolution state.

**Tech Stack:** React, Vanilla CSS

---

### Task 1: Remove CSS Pointer-Event Restriction

**Files:**
- Modify: `client/src/App.css:238-240`

**Step 1: Write the failing verification test**
Since this is a UI change, we will use the browser agent to verify the change.
*Test*: Verify that `.game-world.locked-out` has `pointer-events: none`.

**Step 2: Run verification**
Run: `npx vitest client/src/components/GameBoard.test.js` (Wait, I don't have a specific test for CSS, I'll use browser agent)
Action: Use `browser-agent` to check computed style of `.game-world.locked-out`.
Expected: `pointer-events: none`

**Step 3: Update CSS**
```css
.game-world.locked-out {
    /* pointer-events: none;  <-- REMOVE THIS */
}
```

**Step 4: Verify style change**
Action: Use `browser-agent` to check computed style.
Expected: `pointer-events: auto` (or default)

**Step 5: Commit (Skip per user preference for docs/plans, but I'll commit the code change)**
```bash
git add client/src/App.css
git commit -m "feat: allow pointer events during resolution phase"
```

---

### Task 2: Implement Interaction Guards in GameBoard

**Files:**
- Modify: `client/src/components/GameBoard.jsx:1655, 1708`

**Step 1: Implement guard in handleMouseDown**
Modify `handleMouseDown` to skip aiming logic if `isResolving` is true.

```javascript
<<<<
        if (launchMode && selectedHubId) {
====
        if (!isResolving && launchMode && selectedHubId) {
>>>>
```

**Step 2: Implement guard in handleGlobalMouseUp**
Modify `handleGlobalMouseUp` to skip hub selection if `isResolving` is true.

```javascript
<<<<
                if (isShortClick) {
====
                if (isShortClick && !isResolving) {
>>>>
```

**Step 3: Manual Verification with Browser Agent**
1. Start game in browser.
2. Enter resolution phase.
3. Attempt to drag the map (Expected: SUCCESS).
4. Attempt to click a hub (Expected: NO SELECTION CHANGE).

**Step 4: Commit**
```bash
git add client/src/components/GameBoard.jsx
git commit -m "feat: add interaction guards for resolution phase"
```
