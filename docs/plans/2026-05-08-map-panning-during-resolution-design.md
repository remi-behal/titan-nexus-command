# Design Doc: Map Panning During Resolution Phase

## Goal
Allow players to pan (drag) the map during the execution/resolution phase to observe the battlefield while game actions are resolving.

## Context
Currently, the resolution phase (when `isResolvingUI` is true) applies a `.locked-out` class to the game viewport which sets `pointer-events: none`. This prevents all mouse interaction, including the ability to pan the camera.

## Design

### 1. Style Changes (`App.css`)
- Remove `pointer-events: none` from the `.game-world.locked-out` class.
- This allows mouse events to reach the `GameBoard` component even during resolution.

### 2. Logic Changes (`GameBoard.jsx`)
The `isResolving` prop (already passed from `App.jsx`) will be used to guard specific interactions:

#### `handleMouseDown`
- If `isResolving` is true, the component will skip the `launchMode` / `selectedHubId` check (aiming start) and fall through to the pan initialization logic.

#### `handleGlobalMouseUp`
- If `isResolving` is true, the component will skip the "Short Click" detection logic that normally selects or deselects hubs.

### 3. Verification Plan
- **Manual Verification**:
    1. Start a game.
    2. Submit actions to enter the resolution phase.
    3. Verify that the map can still be dragged/panned while projectiles are flying.
    4. Verify that clicking on hubs during this phase does NOT open the radial menu or change selection.
- **Visuals**:
    - The CRT filters and "locked out" visual cues (contrast/brightness changes) should remain active.
