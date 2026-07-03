# Architecture Design: Team Play (Alliance Mode - Shared Vision & Team Victory)

## Overview
This design outlines the implementation of **Alliance/Team Play Mode** for Titan: Nexus Command. Players can group into Team A or Team B, sharing visibility (Fog of War) and team-level victory/defeat conditions, while retaining independent resource pools (energy, hubs) and experiencing link collisions with teammates just like enemies.

---

## Technical Specifications

### 1. Lobby & Team Selection
- **Lobby Configuration:** The default maximum player count (`maxPlayers`) for a `LobbyRoom` is increased to `8` to support up to 4v4 matches.
- **Seat & Team Toggle:**
  - Each claimed seat/slot in the lobby is represented as `{ token, socketId, ready, team: 'Team A' | 'Team B' }`.
  - Players can toggle their team selection manually in the Lobby UI via a dropdown or toggle button.
  - Toggling emits a `lobby:setTeam` event to the server, which validates the change and broadcasts an updated lobby state.
- **Team Size Limits:**
  - The map configuration can define `maxPlayersPerTeam`. If not defined, it defaults to `4`.
  - The server and client will reject team changes that would exceed the team size limit.

### 2. Map Starting Positions & Placement
- **Designated Bases:**
  - The map configuration's `playerBases` list will support a `team` tag (e.g., `"Team A"` or `"Team B"`).
  - During game initialization, active players on `'Team A'` are sequentially assigned to `'Team A'` designated bases, and players on `'Team B'` are assigned to `'Team B'` designated bases.
  - If a map lacks designated team bases (e.g., custom maps designed for 1v1), the server falls back to neutral bases or standard sequential indexing.
- **Default 8-Player Layout:**
  - The default hardcoded layout is updated to support 8 slots: 4 on the left side of the map (designated for `'Team A'`) and 4 on the right side of the map (designated for `'Team B'`).

### 3. Visibility & Vision Sharing
- **Shared Fog of War:**
  - `VisibilitySystem.isPositionVisible` is updated to check if a coordinate is visible to *any* alive teammate on the player's team.
  - `VisibilitySystem.getVisionCircles` merges vision circles from all players on the same team.
- **Teammate Exemptions:**
  - Teammates can see through teammate cloaks (`CLOAKING_FIELD` does not hide friendly structures/projectiles from teammates).
  - Audible events are shared between teammates.

### 4. Game Rules & Collisions
- **Independent Resources:** Teammates do NOT share energy, hubs, or action counts. Launching a structure or projectile consumes energy from the individual player's pool and fuel from their individual hub.
- **Teammate Link Collision:** Teammate links DO collide with each other if they cross, behaving exactly like enemy links.
- **Team-Level Victory & Defeat:**
  - A player is marked `alive: false` when they lose all their hubs.
  - A team is defeated when all players on that team have `alive: false`.
  - A team wins when all opposing teams have been defeated.
  - If all teams lose their hubs simultaneously, the game ends in a `'DRAW'`.

---

## Open Decisions & Next Steps
- Implement the lobby changes in `LobbyOverlay.jsx` and `LobbyRoom.js`.
- Integrate team properties in `GameState.js` and update starting positions.
- Update `VisibilitySystem.js` to support shared teammate vision.
- Update winner evaluation in `GameState.js` and win UI in `App.jsx`.
