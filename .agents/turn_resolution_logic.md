# Turn Resolution & Phase Lockout Protocol

This document outlines the authoritative handling of turn transitions and the protocol for preventing race conditions via a strict state machine.

## 1. Authoritative Phase Machine
The **Server** (`server/index.js`) is the authoritative manager of the game lifecycle. While the `GameState` engine processes simulation logic, the server controls the timing of turn transitions and phase changes.

- **Phases**:
    - `PLANNING`: Default state. Income is processed, and players can sync/submit actions.
    - `RESOLVING`: Observation state. Triggered when `resolveTurn()` starts. No actions are accepted until resolution is complete.
- **Strict Rejection**: The server implicitly ignores any `syncActions`, `submitActions`, or `passTurn` packets if the current state is `RESOLVING`.
- **Authoritative Transition**: The `PLANNING` phase is explicitly broadcast by the server ONLY after all asynchronous simulation snapshots have been emitted to clients.

## 2. Observation Phase (Stealth Lockout)
To ensure players can watch the resolution without interference, the UI and Server enforce a functional lockout without obstructing the view.

- **UI Lockout**: `App.jsx` uses `isResolvingUI` (derived from `socket.on('resolutionStatus')` and `gameState.phase === 'RESOLVING'`) to disable all interactive buttons and mouse interactions on the `GameBoard`.
- **Clean Visuals**: There are NO central overlays or grayscale filters during resolution. The board remains visually clear while the action plays out.
- **Manual Control**: Players cannot deselect their current Hub or switch launch modes until the server officially resets the phase to `PLANNING`.

## 3. Snapshot Data Convention
Consistent naming is required for both unit tests and frontend rendering.

- **`type: 'PROJECTILE'`**: All transient objects in flight MUST use the literal string `'PROJECTILE'` as their type in the resolution snapshots.
- **`itemType: '...'`**: The specific entity type (e.g., `'HUB'`, `'SUPER_BOMB'`) is passed in the `itemType` field. 
- **Frontend Usage**: `GameBoard.jsx` uses `itemType || type` to look up visual stats (size, color, etc.) in `ENTITY_STATS`.

## 4. Test Stability Guidelines
- **Phase Verification**: Unit tests verify that the `phase` remains `RESOLVING` at the end of engine-level resolution calculations, requiring an explicit server-side trigger to return to `PLANNING`.
- **Race Condition Testing**: Integration tests (e.g., `resolution_race.test.js`) explicitly attempt submissions during the observation period to ensure they are ignored by the server.


