# Responsive Tactical Zoom Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Implement mouse wheel and pinch-to-zoom for the tactical map, anchored to the cursor/pinch center, with dynamic min-zoom to prevent map tiling.

**Architecture:** Lift zoom state to `App.jsx`, update GameBoard coordinate utilities, and implement anchored zoom logic using `cameraOffset` adjustments.

**Tech Stack:** React, HTML5 Canvas, PointerEvents.

---

### Task 1: Lift Zoom State to App.jsx

**Files:**
- Modify: [App.jsx](file:///home/behalr/titan-nexus-command/client/src/App.jsx)
- Modify: [GameBoard.jsx](file:///home/behalr/titan-nexus-command/client/src/components/GameBoard.jsx)

**Step 1: Replace hardcoded ZOOM_LEVEL with state in App.jsx**
- Replace `const ZOOM_LEVEL = 2;` (line 55) with `const [zoom, setZoom] = useState(2);`.
- Update `hubScreenPos` effect (line 333-357) to use `zoom` instead of `ZOOM_LEVEL`.
- Pass `zoom` as a prop to `<GameBoard />` (line 644).

**Step 2: Update GameBoard.jsx to use zoom prop**
- Destructure `zoom` from props in `GameBoard` (line 74).
- Remove `const ZOOM_LEVEL = 2;` (line 80).
- Update all occurrences of `ZOOM_LEVEL` to `zoom` (Lines 1524, 1525, 1561, 1562, 1566, 1567, 1608, 1638, 1639, 1753-1763).

**Step 3: Verify current behavior is unchanged**
- Ensure the game still renders at 2x zoom and UI positioning is correct.

### Task 2: Implement Dynamic Zoom Constraints

**Files:**
- Modify: [App.jsx](file:///home/behalr/titan-nexus-command/client/src/App.jsx)

**Step 1: Calculate dynamic minZoom**
- Add `minZoom` state.
- Add a `useLayoutEffect` to calculate `minZoom` = `Math.max(viewportWidth / 2000, viewportHeight / 2000)`.
- Ensure `zoom` never drops below `minZoom`.

### Task 3: Implement Mouse Wheel Zoom (Anchored)

**Files:**
- Modify: [App.jsx](file:///home/behalr/titan-nexus-command/client/src/App.jsx)

**Step 1: Implement anchored zoom logic**
- Add `onWheel` handler to `.game-world` container.
- Calculate world coords at cursor using current zoom and cameraOffset.
- Update zoom based on `e.deltaY`.
- Calculate new `cameraOffset` so the same world coords stay under the cursor.

### Task 4: Implement Pinch-to-Zoom (Mobile)

**Files:**
- Modify: [App.jsx](file:///home/behalr/titan-nexus-command/client/src/App.jsx)

**Step 1: Add multi-touch support**
- Use `pointerdown`, `pointermove`, `pointerup` to track multiple pointers.
- Calculate distance between two pointers for zoom scale.
- midpoint between pointers for the anchor.

### Task 5: Cleanup and Final Testing

**Step 1: Remove remaining hardcoded values**
- Audit files for any missed `2` or `ZOOM_LEVEL` constants.
- Test at 1440p and mobile viewport sizes.
