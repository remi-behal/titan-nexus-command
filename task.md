# Task List: Turn-Based Multiplayer Game

## Phase 1: Single-Player Prototype (Weeks 1-2)
- [ ] Initialize project (React + Vite) <!-- id: 7 -->
- [ ] **Design Game Core**: Define the "Board" and "Player" state objects <!-- id: 18 -->
- [ ] Implement Basic Rendering (Canvas or DOM) <!-- id: 19 -->
- [ ] Implement Local Game Loop (Input -> State Update -> Render) <!-- id: 20 -->
- [ ] Verify: Play a full "turn" locally against a dummy/mock opponent <!-- id: 21 -->

## Phase 2: Local Multiplayer Setup (Week 3)
- [ ] Initialize Server (Node.js + Socket.io) <!-- id: 3 -->
- [ ] Connect Client to Server <!-- id: 8 -->
- [ ] **Migration**: Move Game State from Client to Server <!-- id: 22 -->
- [ ] Implement Basic Sync: Server broadcasts state, Client renders it <!-- id: 14 -->
- [ ] Verify: Open 2 tabs, improvements in one reflect in the other <!-- id: 23 -->

## Phase 3: Turn System (Week 4)
- [ ] Implement Simultaneous Turn Logic (Timer + Action Queue) <!-- id: 5 -->
- [ ] Implement "Lock In" mechanism <!-- id: 24 -->
- [ ] Implement Server-side Resolution (processing all moves at once) <!-- id: 13 -->
- [ ] Verify: 30s timer forces turn end <!-- id: 25 -->

## Phase 4: Deployment (Week 5)
- [ ] Create `Dockerfile` <!-- id: 26 -->
- [ ] Create `docker-compose.yml` (if needed for future DB, or just simple container) <!-- id: 27 -->
- [ ] Document Nginx Config for Websockets <!-- id: 28 -->
- [ ] Verify: Deployed container accessible via LAN IP <!-- id: 29 -->
