# Architecture Design: HUD and Socket.io Refactoring

## Context & Objectives

Currently, `client/src/App.jsx` serves as a "god component" that orchestrates multiple separate domains:
1. **Network Connectivity**: Handshaking, dynamic Socket.io configuration, session validation, event subscription, and message routing.
2. **Audio/Music Engine state**: Playback track paths, mute/volume states, and subscribing to chiptune player updates.
3. **Interactive Client UI State**: Aiming offsets, camera coordinates, viewport rendering controls, and active outposts.
4. **Layout Shell**: Sidebars, overlays, and status containers.

To improve project readability, testability, and decouple network state from rendering, we will modularize `App.jsx`.

---

## Refactoring Design

### 1. Networking Extraction (`useGameSocket` Hook)
We will create a new custom React hook `useGameSocket` inside `client/src/hooks/useGameSocket.js`. 
- **Socket Initialization**: The module-level `socket` instance is instantiated inside this hook module.
- **Session Management**: Session authentication is handled internally using the pilot session token stored in local storage.
- **Network State**: Houses state variables:
  - `isConnected`
  - `myPlayerId`
  - `playerState`
  - `lobbyStatus`
  - `matchStarted`
  - `syncStatus`
  - `timeRemaining`
  - `isResolving`
  - `chatMessages`
  - `unreadCount`
  - `availableMaps`
  - `lastError`
  - `committedActions`
- **Synchronization and State Resets**:
  - Automatically syncs client-side actions to the server when `committedActions` changes.
  - Automatically clears local action arrays when turn advancement or match restart events fire.
- **Event Listeners**: Sets up and tears down Socket.io event listeners inside a standard React `useEffect`.
- **Emitters**: Exposes cleanly wrapped callback functions for emitting network actions (`handleSendMessage`, `handleExecuteTurn`, `handleRestart`, `handleClaimSeat`, `handleReadyToggle`, `handleSetMap`, `handleMapSave`).

### 2. Audio Control Delegation (`SidebarLeft.jsx`)
Instead of `App.jsx` tracking chiptune media players, we will move that entire responsibility into `client/src/components/HUD/SidebarLeft.jsx`.
- **Local Audio State**: `SidebarLeft` will house the state variables `audioVolume`, `audioMuted`, `currentTrackPath`, `audioPlaying`, and `audioShuffle`.
- **Subscription**: Directly imports `audioManager` and sets up a `useEffect` subscription to keep its local state in sync.
- **Interaction Warm-up**: Implements the user-click window listener to initialize the browser's audio context safely on first interaction.
- **Prop Cleanup**: Reduces the props passed to `SidebarLeft` in `App.jsx` by 12+ fields.

### 3. Unified Layout Component (`App.jsx`)
`App.jsx` will be simplified to a layout routing component:
- Retrieves all network and player state from `useGameSocket()`.
- Retains local UI concerns (camera zoom, panning bounds, radial aiming positions, and CRT rendering styles).
- Renders the child modules layout, keeping JSX and code clean.

---

## Decision Record
- **Decided**: Move Socket.io connections/event management into `useGameSocket` hook.
- **Decided**: Encapsulate chiptune music controls and subscriptions entirely inside `SidebarLeft.jsx`.
- **Rejected**: Retaining connection listeners inside `App.jsx` inline, as it leads to large file footprints and makes testing HUD layout in isolation complex.
