# Project Roadmap: Titan: Nexus Command

## 🎯 Global Goal
Build a browser-based, simultaneous turn-based strategy game for 2-8 players set on Titan. Use a physics-based "Slingshot" mechanic for expansion and combat.

## 📍 Current Status: Phase 3
We have a working multiplayer monorepo where two players can connect, lock in turns, and sync state.

---

## 🗺️ Phase Roadmap

### ✅ Phase 1: Prototype
- Single-player local state engine.
- Slingshot physics and basic Hub selection.
- Win/Loss detection.

### ✅ Phase 2: Multiplayer Foundation
- Node.js + Socket.io integration.
- Monorepo structure with `shared/` logic.
- "Lock In" synchronization for simultaneous turns.
- Vite bridge/proxy for networking stability.

### 🏗️ Phase 3: Authority & Rules (Current)
- Server-side validation of moves and energy.
- Turn Timers to auto-resolve rounds.
- Player ownership enforcement.

### 🌫️ Phase 4: Fog of War
- Dynamic Line-of-Sight (LOS).
- Persistent "Ghost" memory of enemy buildings.
- Server-side data sharding for hidden units.

### 🚀 Phase 5: Topology (Toroidal World)
- Implementation of the "Wrapping" map logic.
- Tiled rendering for seamless boundary viewing.

### 💅 Phase 6: Deployment
- Dockerization.
- Production UI/UX pass.
- OpenMediaVault hosting.

### Phase 7: Game feature expansion
- Adding game features (TBD)

### Phase 8: Artwork, UI/UX, Music
- Adding artwork, UI/UX, music, and sound effects.
- Adding lore, world building
- Map design (TBD)
