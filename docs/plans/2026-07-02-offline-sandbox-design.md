# Architecture Design: Offline Practice Range (Sandbox Mode)

## Context & Objectives
To help players test slingshot trajectories, weapon impacts, and defensive counters without needing a running server or active opponent, we will implement an offline "Practice Range".

---

## Constraints
1. **Lobby Entrance Only**: The Practice Range must only be accessible from the main Lobby screen (when no active match is running). It cannot be entered mid-game.
2. **Abundant Resources**: Players start with a very high energy capacity (e.g., 9,999 energy) to permit limitless deployment of weapons, nukes, and shields.
3. **Simultaneous Dual-Control**: The user can toggle between controlling Player 1 and Player 2 during the planning phase to set up custom tests (e.g. testing interceptor shields against homing missiles).

---

## Detailed Design

### 1. View Entry
- We add a `"Practice Range"` button in `LobbyOverlay.jsx`.
- When clicked, it sets the application view mode to `"SANDBOX"`.
- The button is only visible when the match has not yet started.

### 2. State & Engine Initialization
- In `"SANDBOX"` view, the client instantiates `new GameState()` and initializes a 2-player match (`['player1', 'player2']`) using a statically imported `playgroundMap` configuration.
- We immediately override the starting energy:
  ```javascript
  localGame.players.player1.energy = 9999;
  localGame.players.player2.energy = 9999;
  ```
- The local game state is stored in a React component state `sandboxState` to trigger re-renders.

### 3. Planning & Action Commit
- A state variable `sandboxActions` tracks staged actions: `{ player1: [], player2: [] }`.
- A UI selector allows toggling the active planning player. Staged actions are automatically assigned to the active player's ID.
- Accesses existing GameBoard coordinates, lines, and HUD controls.

### 4. Client-Side Sim Resolution
- When the user triggers "Execute Simulation":
  - Call `localGame.resolveTurn(sandboxActions)`.
  - Disable UI inputs.
  - Sequentially stream each snapshot to `sandboxState` using a standard `setTimeout` loop (60ms for sub-ticks, 1500ms for phase transitions) to reproduce the server-side turn replay.
  - Reset action buffers and increment turn counter upon completion.
