# Task Tracking: Titan: Nexus Command

## 🎯 Active Phase: Phase 6 (Game Feature Expansion)

### 📂 To Do

#### Phase 6 (Game Feature Expansion)

- [x] **Intercept System**: Implement logic for Defense structures to target and destroy incoming weapons. <!-- id: 44 -->
    - [x] Add Laser Defense to the game. <!-- id: 51 -->
    - [x] Add light SAM defense <!-- id: 52 -->
    - [x] Add flak defense <!-- id: 53 -->
- [x] **Economy Expansion**: Implement Extractor logic for additional energy generation. <!-- id: 45 -->
- [ ] **Map Features**: <!-- id: 46 -->
    - [x] Lakes (Non-buildable, Link-blocking) <!-- id: 84 -->
    - [x] Mountains (Non-buildable, Link-traversable) <!-- id: 55 -->
    - [x] Energy Nodes (Static locations for Extractors) <!-- id: 13 -->
    - [x] Super Energy Nodes (High yield, competitive) <!-- id: 56 -->
- [ ] **Weapon/Defense Expansion**: <!-- id: 86 -->
    - [x] **Cluster Bomb**: Implement separation into multiple sub-bombs landing in a perpendicular line. <!-- id: 87 -->
    - [x] **Nuke**: Implement a structure type weapon that destroys everything in a large radius after a single turn. <!-- id: 88 -->
    - [x] **Reclaimer**: Weapon that only targets friendly structures. Deletes the friendly structure and refunds 50% of the cost (rounded up to nearest integer). <!-- id: 89 -->
    - [x] **EMP**: Implement a weapon that disables structures in a radius. <!-- id: 90 -->
    - [x] **Echo artillery**: Anti artillery automatic weapon. <!-- id: 91 -->
    - [x] **Overload**: Link spreading weapon. <!-- id: 92 -->
    - [x] **Shield**: Add shield structure type. <!-- id: 93 -->
    
- [ ] **Multiplayer Enhancements**: <!-- id: 47 -->
    - [ ] Chat system.
    - [ ] Lobby management / Player slotting.
- [ ] **Conflict Resolution & Pathing**: <!-- id: 74 -->
    - [x] **Structure Overlap**: Both destroyed if landing same spot. <!-- id: 59 -->
    - [x] **Autonomous Projectiles**: Persist if source hub destroyed. <!-- id: 60 -->
    - [ ] **Post-Mortem Revenge**: Finish paths before elimination. <!-- id: 61 -->
    - [ ] **Defensive Overkill**: Defenses reacquire if target gone. <!-- id: 62 -->
    - [ ] **Target Ambiguity**: Guided missiles reacquire or fly straight. <!-- id: 63 -->
    - [ ] **Homing Commitment**: Define "Smart" vs "Dumb" homing. <!-- id: 64 -->
- [x] **Link Enhancement**: Add direction arrows to links indicating the source Hub. <!-- id: 53 -->
- [x] **Link Collision**: Destroy structures if their link crosses an existing link. <!-- id: 54 -->
- [ ] **Resolution Polish**: <!-- id: 58 -->
    - [ ] Improve Resolution Overlay visibility/intrusiveness. <!-- id: 82 -->
    - [ ] Add offensive roles for Defense structures (TBD). <!-- id: 65 -->

#### Phase 7: Artwork, UI/UX, Music

- [ ] Adding artwork, UI/UX, music, and sound effects.
- [ ] Adding lore, world building.
- [ ] Map design.

#### Phase 8 (Deployment)

- [ ] **Dockerization**: <!-- id: 41 -->
- [ ] **Production UI/UX Pass**: <!-- id: 42 -->
- [ ] **Host on OMV**: <!-- id: 43 -->

---

## ⏳ Backlog

- [ ] **Team Play**: Shared energy and hubs. <!-- id: 48 -->
- [ ] **Dynamic Weather**: Methane rain and high winds. <!-- id: 49 -->
- [ ] **Spectator Mode**: Ability to watch without a player slot. <!-- id: 50 -->
- [ ] **Testing & Refinement**: <!-- id: 52 -->
    - [x] **Draw Condition**: Implement and test simultaneous destruction of all hubs. <!-- id: 66 -->
    - [x] **Connection & Networking**: <!-- id: 75 -->
        - [x] Reconnect gracefully after drops. <!-- id: 67 -->
        - [x] Handle disconnect while action is "Locked In". <!-- id: 69 -->
        - [x] Latency Simulation (100ms+ ping). <!-- id: 68 -->
        - [x] Match Restart Persistence & Auto-Reclaim. <!-- id: 80 -->
    - [ ] **Test Coverage Expansion**: <!-- id: 76 -->
        - [ ] Server-side Action Validation (ownership, energy, fuel). <!-- id: 70 -->
        - [x] Socket.io event handling & Multi-player sync tests. <!-- id: 77 -->
        - [x] End-to-End game flow. <!-- id: 84 -->
        - [ ] Expanded End-to-End game flow. <!-- id: 71 -->
    - [ ] **Performance & Stress**: <!-- id: 78 -->
        - [ ] 8-player stress test. <!-- id: 72 -->
        - [ ] Large entity count (100+) performance. <!-- id: 79 -->
        - [ ] Animation frame rate under load. <!-- id: 80 -->
    - [ ] **Platform Support**: <!-- id: 81 -->
        - [ ] Mobile/Touchscreen slingshot verification. <!-- id: 73 -->
    - [ ] **Game Feature Expansion**: <!-- id: 84 -->
        - [ ] Multi-round projectiles. Brainstorm weapons <!-- id: 85 -->
    - [ ] **Weapon finetuning**: <!-- id: 86 -->
        - [ ] Adjust weapon stats to make the game more fun. <!-- id: 87 -->
        - [ ] Flak defense - damage is applied the instant a projectile enters the cone, making the effect look bad. Brainstorm solutions. <!-- id: 88 -->
        - [ ] Global vision for projectiles needs to be increased. <!-- id: 89 -->
        - [ ] Nuke hazard should give vision to owner. <!-- id: 90 -->
        - [ ] Fog of war not quite working correctly <!-- id: 91 -->
            - [ ] can't see the fog...probably just a shading issue <!-- id: 92 -->
            - [ ] Should be able to see player colour for ghosts <!-- id: 93 -->
        - [ ] Cluster bomb preview should show where all projectiles land <!-- id: 94 -->
        - [ ] Bug - echo artillery ignores EMP effect <!-- id: 95 -->
        - [ ] Visuals - shields should recharge just before planning phase so that opponents know it will have 1 hp. Same idea with flak, it stays active during planning phase.
        - [ ] Slingshot should warn launch and deny launch if you can see your new link will cross an existing link from that same hub. Maybe expand to warn if it crosses any links of your future launches also. <!-- id: 96 -->
        - [ ]
    - [ ] Expand test coverage to `server/` and `client/` (Specifically for sockets and React components). <!-- id: 83 -->

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
- [x] **Turn Timer**: <!-- id: 18 -->
    - [x] Server: Implement a 30s countdown that auto-resolves turns. <!-- id: 19 -->
    - [x] Client: Display the countdown in the header. <!-- id: 20 -->
- [x] **Energy Enforcement**: <!-- id: 21 -->
    - [x] Server: Verify energy costs before allowing a launch. <!-- id: 22 -->
    - [x] Client: Grey out structure types if energy is too low. <!-- id: 23 -->
- [x] **Ownership Guard**: <!-- id: 24 -->
    - [x] Server: Verify that the `sourceId` for an action belongs to the requesting `playerId`. <!-- id: 25 -->
- [x] **Simultaneous Turn Logic** (Collision Handling) <!-- id: 26 -->
    - [x] Brainstorm issues/conflicts that might arise from simultaneous actions <!-- id: 27 -->
- [x] **Iterative Round Resolution**: <!-- id: 33 -->
    - [x] Server: Implement sub-round loop in `resolveTurn` <!-- id: 34 -->
    - [x] Server: Implement "Link Decay" check at end of each sub-round <!-- id: 35 -->
- [x] **Fix Sling Launch Direction Bug**: <!-- id: 37 -->
    - [x] Shared: Centralize angle math in `GameState` <!-- id: 38 -->
    - [x] Client: Implement global mouse drag handling <!-- id: 39 -->

### Phase 4 (Topology)

- [x] Modular coordinate math (`%`). <!-- id: 29 -->
- [x] 3x3 tiled rendering in Canvas. <!-- id: 30 -->
- [x] Click, drag and release to scroll the map. <!-- id: 40 -->

### Phase 5 (Fog of War)

- [x] Vision mask calculation. <!-- id: 31 -->
- [x] Server-side unit hiding (State Sharding). <!-- id: 32 -->
- [x] Ghost Layer implementation (Persistence in UI). <!-- id: 51 -->
