# Task Tracking: Titan: Nexus Command

## 🎯 Active Phase: Phase 3 (Authority & Rules)

### 📂 To Do
- [x] **Turn Timer**: <!-- id: 18 -->
    - [x] Server: Implement a 30s countdown that auto-resolves turns. <!-- id: 19 -->
    - [x] Client: Display the countdown in the header. <!-- id: 20 -->
- [x] **Energy Enforcement**: <!-- id: 21 -->
    - [x] Server: Verify energy costs before allowing a launch. <!-- id: 22 -->
    - [x] Client: Grey out structure types if energy is too low. Do not allow launch if energy is too low. <!-- id: 23 -->
- [x] **Ownership Guard**: <!-- id: 24 -->
    - [x] Server: Verify that the `sourceId` for an action belongs to the requesting `playerId`. <!-- id: 25 -->
 - [x] **Simultaneous Turn Logic** (Collision Handling) <!-- id: 26 -->
    - [x] Brainstorm issues/conflicts that might arise from simultaneous actions <!-- id: 27 -->
    - [x] In the event of conflict, decicision tree/priority order of actions (NO CONFLICTS ACTED ON, REDO TASK LATER) <!-- id: 28 -->
 - [ ] **Iterative Round Resolution**: <!-- id: 33 -->
    - [ ] Server: Implement sub-round loop in `resolveTurn` <!-- id: 34 -->
    - [ ] Server: Implement "Link Decay" check at end of each sub-round <!-- id: 35 -->
    - [ ] Server: Handle "Autonomous Projectiles" (revenge) logic <!-- id: 36 -->

---

## ⏳ Backlog

### Toroidal Map (Phase 4)
- [ ] Modular coordinate math (`%`). <!-- id: 29 -->
- [ ] 3x3 tiled rendering in Canvas. <!-- id: 30 -->

### Fog of War (Phase 5)
- [ ] Vision mask calculation. <!-- id: 31 -->
- [ ] Server-side unit hiding. <!-- id: 32 -->

---

## ✅ Completed

### Phase 1 (Prototype)
- [x] Initialize project (React + Vite) <!-- id: 1 -->
- [x] **Design Game Core**: Define the "Board" and "Player" state objects <!-- id: 2 -->
- [x] Implement Basic Rendering (Canvas or DOM) <!-- id: 3 -->
- [x] Implement Local Game Loop (Input -> State Update -> Render) <!-- id: 4 -->
- [x] Verify: Play a full "turn" locally against a dummy/mock opponent <!-- id: 5 -->
- [x] Slingshot pull/push basic math. <!-- id: 6 -->

### Phase 2 (Multiplayer)
- [x] Initialize Server (Node.js + Socket.io) <!-- id: 7 -->
- [x] Connect Client to Server <!-- id: 8 -->
- [x] **Migration**: Move Game State from Client to Server <!-- id: 9 -->
- [x] Implement Basic Sync: Server broadcasts state, Client renders it <!-- id: 10 -->
- [x] Verify: Open 2 tabs, actions in one reflect in the other <!-- id: 11 -->
- [x] Create monorepo structure. <!-- id: 12 -->
- [x] Setup Socket.io bridge. <!-- id: 13 -->
- [x] Implement "Lock In" sync. <!-- id: 14 -->
- [x] Fix white screen of death. <!-- id: 15 -->

### Phase 3 (Authority & Rules)
- [x] Implement "Lock In" mechanism <!-- id: 16 -->
- [x] Implement Server-side Resolution (processing all moves at once) <!-- id: 17 -->