# Turn Resolution & Phase Lockout Protocol

**IMPORTANT**: This document must be respected, it is the golden rule. If needing to change the state machine, the user must be consulted first!

This document defines the authoritative lifecycle of a turn in Titan: Nexus Command. It ensures perfect synchronization between the server and all clients while preventing race conditions.

## Executive Summary (Plain English)
The game operates on a strict "Stop-and-Watch" cycle. During the **Planning Phase**, you can aim and commit actions. When the turn ends, the game enters a **Resolution Phase** where the server simulation runs. During this time, the board is "locked"—buttons and aiming are disabled—allowing everyone to watch the results without interference. Once the simulation is over, the server resets the board and starts the next planning timer. If you try to submit an action at the very last millisecond and it arrives late, the server will ignore it entirely and the client will wipe it from memory to ensure Turn 2 starts fresh.

---

## 1. Full State Machine Lifecycle

### **Step 1: Planning Phase (Interactive)**
-   **Server State**: `phase: 'PLANNING'`.
-   **Client State**: Buttons enabled; Hubs selectable.
-   **Logic**: 
    -   Players drag from Hubs to aim.
    -   Committing an action displays a **Launch Arrow** and **Action Number**.
    -   Actions are synced to the server as they are created ("Save-as-you-go").
    -   These plans are private; opponents see nothing until resolution.
-   **Transition**: Ends when the 30s timer hits 0 OR both players click "Complete Turn."

### **Step 2: Transition to Resolution (The Hard Lock)**
-   **Server State**: `phase: 'RESOLVING'`.
-   **Logic**:
    -   Server broadcasts `resolutionStatus(active: true)`.
    -   Server begins ignoring all incoming action packets (**Hard Drop Protocol**). Any action arriving now is lost, not carried over.
-   **Client Response**:
    -   `isResolvingUI` becomes true; all buttons and board interactions are disabled.
    -   **Memory Wipe**: The client clears `committedActions`, `selectedHubId`, and `launchMode` to ensure a clean slate for the next turn.

### **Step 3: Resolution Phase (The Simulation)**
-   **Server State**: `phase: 'RESOLVING'`.
-   **Logic**:
    -   Server calculates the physics, collisions, and damage for the entire turn.
    -   Server "streams" snapshots of every round back to the clients.
-   **Client Response**:
    -   The `GameBoard` renders the projectiles and landings based on the incoming snapshots.
    -   The UI remains locked and visually clear (no overlays).

### **Step 4: Turn Advancement (The Next Turn)**
-   **Server State**: Briefly pauses for an "observation delay" (~1s).
-   **Logic**:
    -   Server increments the global Turn counter.
    -   Server clears all "Locked In" statuses and resets the 30s timer.
    -   Server sets `phase: 'PLANNING'`.
-   **Client Response**:
    -   Server broadcasts `resolutionStatus(active: false)` and the final `gameStateUpdate`.
    -   Buttons re-enable; players can immediately begin planning for the new turn.

---

## 2. Technical Implementation Details

### **Hard Drop Protocol**
If a network packet containing an action arrives while the server is in the `RESOLVING` phase, it is discarded immediately. This prevents a "late" action from Turn 1 from accidentally appearing in the simulation for Turn 2.

### **Snapshot & Data Conventions**
-   **`type: 'PROJECTILE'`**: All transient objects in flight MUST use this literal string.
-   **`itemType`**: Set to the specific entity type (e.g., `'HUB'`, `'EXTRACTOR'`, `'WEAPON'`).
-   **Visuals**: `GameBoard.jsx` uses `itemType || type` to look up sizes and colors in `ENTITY_STATS`.

### **Test Stability**
-   **Unit Tests**: Must verify that the phase remains `RESOLVING` until an explicit server-side trigger is fired.
-   **Integration Tests**: (e.g., `resolution_race.test.js`) verify that submissions sent during Phase 3 are ignored and do not pollute the next turn's state.
