# Mobile Slingshot Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Enable mobile accessibility for the slingshot by refactoring input logic to use unified Pointer Events and disabling browser-default touch behaviors.

**Architecture:**
1.  **CSS Layer:** Apply `touch-action: none` and UI-polishing CSS to the canvas to prevent scrolling and grey "tap highlights" on mobile.
2.  **Input Layer:** Refactor `GameBoard.jsx` to use `PointerEvents` (`pointerdown`, `pointermove`, `pointerup`), which automatically handles both mouse and touch input.
3.  **Coordinate Layer:** Ensure coordinate mapping in `getGameCoords` remains consistent across all pointer types.

**Tech Stack:** React, CSS, Pointer Events API.

---

### Task 1: CSS Mobile Optimization

**Files:**
- Modify: `client/src/App.css`

**Step 1: Add mobile-friendly canvas styles**
Add the following to `client/src/App.css`:

```css
canvas {
    touch-action: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
}
```

**Step 2: Commit**
```bash
git add client/src/App.css
git commit -m "style: add mobile-friendly touch-action and tap styles to canvas"
```

---

### Task 2: Refactor Coordinate Mapping

**Files:**
- Modify: `client/src/components/GameBoard.jsx:1500-1532`

**Step 1: Update `getGameCoords` to handle Pointer Events**
The existing `getGameCoords` uses `e.clientX` and `e.clientY`, which are available on `PointerEvent`. Ensure no mouse-specific properties are being used.

**Step 2: Commit**
```bash
git add client/src/components/GameBoard.jsx
git commit -m "refactor: ensure getGameCoords is pointer-event compatible"
```

---

### Task 3: Refactor Event Listeners

**Files:**
- Modify: `client/src/components/GameBoard.jsx`

**Step 1: Update `handleMouseDown` to `handlePointerDown`**
Rename `handleMouseDown` to `handlePointerDown`.

**Step 2: Update JSX to use `onPointerDown`**
Change `onMouseDown={handleMouseDown}` to `onPointerDown={handlePointerDown}` on the `<canvas>` element.

**Step 3: Update `useEffect` for global listeners**
Change `window.addEventListener('mousemove', ...)` to `window.addEventListener('pointermove', ...)` and `mouseup` to `pointerup`.

**Step 4: Commit**
```bash
git add client/src/components/GameBoard.jsx
git commit -m "feat: unify mouse and touch input using Pointer Events API"
```

---

### Task 4: Verification

**Step 1: Verify on Desktop**
Verify that mouse interactions (panning, slingshot aiming) still work as expected.

**Step 2: Verify on Mobile (Emulation or Device)**
Verify that touch interactions work, and the page does not scroll when dragging on the canvas.
