# Design Doc: Map Selection System

## Goal
Implement a way for players to select a specific map layout in the lobby before starting a match. The system must maintain test suite stability by defaulting to the current hardcoded layout when no selection is made.

## Requirements
- **Host Authority**: Only the first player to join the lobby can select the map.
- **Source**: Maps are sourced from `shared/ready_maps/`.
- **Backward Compatibility**: Existing tests must pass without modification by using the default map layout.
- **Dynamic Updates**: Map selection changes in the lobby must sync in real-time to all connected players.
- **Persistence**: Maps are loaded from JSON files on the server at match start.

## Technical Approach

### 1. GameState Evolution
`GameState.initializeGame(config = null)` will be refactored:
- If `config` is `null`: Use existing hardcoded layout logic.
- If `config` is provided: 
    - Clear existing map arrays (`resources`, `lakes`, `mountains`).
    - Populate these arrays from the `config` object.
    - Set starter `HUB` positions from `config.playerBases`.

### 2. Server-Side Lobby Management
- **Lobby State**: The server’s lobby object will track `selectedMapName`.
- **Map Discovery**:
    - Server will scan `shared/ready_maps/` for `.json` files.
    - A new socket event `room:listMaps` will return this list to clients.
- **Selection Event**:
    - `lobby:setMap(mapName)`: Only processed if sent by the lobby host (Player 1).
    - Broadcasts updated lobby state to all clients.
- **Match Start**:
    - When `startGame` is triggered, the server reads the JSON for the `selectedMapName`.
    - It passes this data to the `GameState` constructor/initializer.

### 3. Client-Side Lobby UI
- **Map Selector**: A dropdown or list in `LobbyOverlay.jsx`.
- **Visibility**: All players see the selected map name.
- **Interaction**: Only enabled for Player 1.
- **Integration**: On mount, the lobby requests the list of available maps.

## Risks & Mitigations
- **Large Map Files**: Keep map JSONs reasonably sized. Map data is only sent once at match start.
- **Test Flakes**: Since `initializeGame()` defaults to the old logic, tests relying on hardcoded positions (like collision tests) remain isolated.

## Implementation Plan (Sketch)
1. Create `shared/ready_maps/` directory.
2. Refactor `GameState.initializeGame`.
3. Add `selectedMapName` to server `lobby` state.
4. Implement `lobby:setMap` and `room:listMaps` socket events.
5. Update `LobbyOverlay.jsx` with selection UI.
6. Update `server/index.js` to load and inject map JSON on match start.
