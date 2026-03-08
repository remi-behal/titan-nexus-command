# Turn Resolution & Phase Lockout Protocol

This document outlines the authoritative handling of turn transitions and the protocol for preventing race conditions via a strict state machine.

## 1. Authoritative Phase Machine
The game engine (`shared/GameState.js`) is the source of truth for the game lifecycle. It uses a `phase` property to control action availability.

- **Phases**:
    - `PLANNING`: Default state. Income is processed, and players can sync/submit actions.
    - `RESOLVING`: Observation state. Triggered when `resolveTurn()` starts. No actions are accepted until resolution is complete.
- **Strict Rejection**: Both the Server (`server/index.js`) and the Engine explicitly reject any `syncActions`, `submitActions`, or `passTurn` packets if the current phase is `RESOLVING`.

## 2. Observation Phase (Stop-and-Watch)
To ensure players fully absorb the results of a turn, the UI and Server enforce a complete lockout during the cinematic replay.

- **UI Lockout**: The frontend renders a grayscale overlay and disables all interactive buttons while `gameState.phase === 'RESOLVING'`.
- **Delayed Reset**: Locks and turn actions are only reset on the server *after* the resolution snapshots have been fully broadcast to clients.

## 3. Snapshot Data Convention
Consistent naming is required for both unit tests and frontend rendering.

- **`type: 'PROJECTILE'`**: All transient objects in flight MUST use the literal string `'PROJECTILE'` as their type in the resolution snapshots.
- **`itemType: '...'`**: The specific entity type (e.g., `'HUB'`, `'SUPER_BOMB'`) is passed in the `itemType` field. 
- **Frontend Usage**: `GameBoard.jsx` uses `itemType || type` to look up visual stats (size, color, etc.) in `ENTITY_STATS`.

## 4. Test Stability Guidelines
- **Phase Verification**: Unit tests verify phase transitions via `snapshots[i].state.phase`.
- **State Polling**: Integration tests wait for `state.phase` to return to `PLANNING` before verifying Turn N+1 results.

