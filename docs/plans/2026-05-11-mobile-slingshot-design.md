# Design Document: Mobile Slingshot Accessibility

## Goal
Enable mobile accessibility for the slingshot "pull-and-release" interaction using modern web standards.

## Proposed Changes

### 1. Stylistic Isolation
- Apply `touch-action: none` to the game canvas to disable browser-default scrolling and zooming.
- Disable text selection and tap highlights on the canvas to ensure a clean "app-like" feel.

### 2. Unified Event Handling (Pointer Events)
- Refactor `GameBoard.jsx` to use the `PointerEvents` API.
- Replace `onMouseDown` with `onPointerDown`.
- Replace `window` listeners for `mousemove` and `mouseup` with `pointermove` and `pointerup`.
- Ensure `getGameCoords` correctly extracts coordinates from pointer events.

### 3. Coordinate Consistency
- Maintain the current 1:1 interaction model where the pull vector is calculated directly from the touch/pointer position.
- No offsets or virtual joysticks will be implemented in this phase.

## Verification Plan

### Manual Verification
- **Desktop (Mouse):** Verify that clicking and dragging still works exactly as before.
- **Mobile (Touch):** Verify that touching a hub, dragging back, and releasing correctly launches a projectile.
- **Browser Behavior:** Confirm that dragging on the canvas does NOT scroll the page or trigger pull-to-refresh on mobile.
