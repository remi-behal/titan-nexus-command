# Fog of War Restoration Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Restore Fog of War visibility and Terrain features by fixing background contrast, culling logic, and fog composition.

**Architecture:** 
1. Modify `GameBoard.jsx` to lighten the background and add a tactical grid for contrast.
2. Fix the 3x3 tiled culling logic for terrain (lakes, mountains) to ensure they render correctly even when panned/zoomed.
3. Synchronize `fogCanvas` transformations to ensure vision "holes" align with player-owned entities.

**Tech Stack:** React, Canvas API (2D)

---

### Task 1: Fix Background Contrast & Grid
**Files:**
- Modify: `client/src/components/GameBoard.jsx:390-405`

**Step 1: Update background color and implement grid**
Replace the solid `#000000ec` fill with a tactical charcoal background and a faint grid. This provides the necessary contrast for the 70% black fog overlay.

**Step 2: Verification**
Run the game and check if the background is a dark charcoal with a subtle grid pattern.

### Task 2: Restore Terrain Rendering (Lakes & Mountains)
**Files:**
- Modify: `client/src/components/GameBoard.jsx:410-450`

**Step 1: Audit and fix culling logic**
Check the `viewL/viewR/viewT/viewB` bounds check for lakes and mountains. Ensure it accounts for the `ox` and `oy` offsets correctly within the 3x3 loop.

**Step 2: Verification**
Verify that lakes (dark blue) and mountains (dark brown) are visible on the map, even in unvisited areas (where they will be dimmed by fog).

### Task 3: Synchronize Fog Punching
**Files:**
- Modify: `client/src/components/GameBoard.jsx:623-713`

**Step 1: Ensure vision holes align**
Verify that `fctx.scale(zoom, zoom)` and `fctx.translate(-cameraOffset.x, -cameraOffset.y)` exactly match the main `ctx` transforms. Fix any misalignment causing holes to disappear or drift.

**Step 2: Verification**
Move a player-owned entity and confirm a bright vision circle follows it, revealing the background grid and terrain.

### Task 4: Final Aesthetic Polish
**Files:**
- Modify: `client/src/components/GameBoard.jsx`
- Modify: `client/src/constants/VisualStats.js`

**Step 1: Adjust fog alpha**
Increase fog opacity to 0.8 or 0.85 if needed to make "unseen" areas feel more distinct and dangerous.

**Step 2: Verification**
Confirm the overall look meets the "premium tactical" design goal.
