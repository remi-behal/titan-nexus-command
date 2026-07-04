# Design Document: Multi-Room Lobby for Titan: Nexus Command

## Overview
This document outlines the design and architecture for adding multiple dynamic rooms (sectors) to the lobby of *Titan: Nexus Command*. Players will be able to create, view, join, and leave isolated room sessions, allowing multiple independent games to run concurrently on the same server.

---

## 1. Architecture & Server-Side Models

### 1.1 `SessionContext.js` Refactoring
The global game state variables currently managed in `SessionContext` will be removed and encapsulated entirely within the `LobbyRoom` instances.
*   **Properties to Remove**: `game`, `playerAssignments`, `activeSockets`, `turnActions`, `lockedIn`, `matchStarted`.
*   **Retained Properties**:
    *   `lobbyManager`: Handles the collection of rooms.
    *   `io`: Global socket server instance.
    *   `SIMULATED_LATENCY`, `TURN_DURATION`: Configurations.

### 1.2 `LobbyRoom.js` Enhancements
Each room will manage its own complete game context and timer service:
*   **New Room-Scoped State**:
    *   `game`: A new `GameState` instance per room.
    *   `timerService`: An instance of `TimerService` bound to the specific room's game context.
    *   `playerAssignments`: Map of `playerId -> playerToken`.
    *   `activeSockets`: Map of `playerId -> socketId`.
    *   `turnActions`: Turn submissions scoped to the room's players.
    *   `lockedIn`: Ready status for turn execution.
    *   `matchStarted`: Boolean flag for the game status of this room.
*   **New Helper Methods**:
    *   `getMetadata()`: Returns `{ id, playerCount, maxPlayers, status }` for room listing.
    *   `reset()`: Restores the room back to lobby status and clears previous match state.

### 1.3 `LobbyManager.js` Enhancements
*   `getRoomList()`: Returns metadata for all active rooms.
*   `createRoom(roomId, maxPlayers)`: Creates and registers a new room.
*   `deleteRoom(roomId)`: Stops timers and deletes the room from memory if empty.
*   `findRoomBySocketId(socketId)`: Locates the room containing a specific socket.

---

## 2. Socket Networking & Routing

### 2.1 Partitioning with Socket.io Rooms
We will utilize Socket.io's `socket.join(roomId)` to segment connections.
*   Upon joining a room, the socket joins the room channel: `socket.join(roomId)`.
*   We store the active room on the socket object: `socket.currentRoomId = roomId`.
*   All game state and lobby updates are broadcast exclusively to the room: `io.to(roomId).emit(...)`.

### 2.2 New Socket Events
*   `lobby:listRooms`: Responds with the active rooms list.
*   `lobby:createRoom`: Creates a room, joins the socket to it, and broadcasts the updated room list.
*   `lobby:joinRoom`: Moves the socket to the target room and updates room membership.
*   `lobby:leaveRoom`: Clears room membership, deletes the room if empty, and returns the player to the list.

---

## 3. Client-Side UI & Integration

### 3.1 Consistent Space Theme
The new Room Browser UI will share the core dark/sci-fi palette, fonts, and borders of the existing HUD.
*   **Background**: Deep black/blue space styling.
*   **Accents**: Neon blue borders for static/lobby states, neon orange borders for active games.
*   **Typography**: Clean sans-serif uppercase headers.

### 3.2 View Flow
1.  **Browser View**: Shown when `currentView === 'LOBBY'` and `currentRoomId` is null.
    *   Room Creation: Text input (e.g. "Sector Code") + "Launch Sector" button.
    *   Room List Grid: Cards showing Sector ID, players, and state.
2.  **Lobby View**: Displays the existing `LobbyOverlay` component with an added "Leave Sector" option.

---

## 4. Testing & Verification

*   **Integration Tests**: Update `integration_lobby.test.js`, `auto_start.test.js`, and `action_validation.test.js` to initialize rooms and assign socket connections to the correct room before running test scenarios.
*   **Sanity Checks**: Verify that starting a match in `Room A` does not trigger state updates or start matches in `Room B`.
