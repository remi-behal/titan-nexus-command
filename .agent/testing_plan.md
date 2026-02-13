# Testing Plan: Titan: Nexus Command

This document outlines the testing scenarios required to ensure game stability, balance, and networking synchronization.

## 🤖 Automated Testing
Automated unit tests validate the core game engine logic. See `.agent/testing_strategy.md` for full details.

- [x] **Unit Tests**: 25 tests covering slingshot math, toroidal wrapping, link integrity, turn resolution, and win conditions (98.3% coverage)
- [ ] **Integration Tests**: Server-side action validation and Socket.io event handling
- [ ] **E2E Tests**: Full game flow from lobby to victory

**Run tests**: `npm test` (see `.agent/workflows/test.md`)


## 🟢 Phase 1: Local Prototype Testing
Validated the core physics and state management in a single-client environment.

- [x] **Hub Selection**: Clicking a player-owned Hub highlights it and enables launch mode.
- [x] **Slingshot Mechanics**: Pulling back correctly calculates the opposite launch vector.
- [x] **Power Clamping**: Pulling beyond `MAX_DISTANCE` caps the launch velocity.
- [x] **Win Condition**: Destroying the enemy Hub triggers the Victory Overlay and mission end.
- [ ] **Draw Condition (PENDING)**: Simultaneous destruction of all remaining player Hubs in one turn.
    *   *Note: Currently difficult to test in single-player simulation without multi-action support.*

## 🟡 Phase 2: Multiplayer & Sync Testing
Focus on the transition from local state to server-side authority.

- [ ] **Connection Stability**: Clients reconnect gracefully if the websocket drops.
- [ ] **State Reconciliation**: Client renders exactly what the server broadcasts, even if local lag occurs.
- [x] **Multi-Tab Sync**: Actions taken in Tab A are visible on the next turn visible in Tab B, and vice-versa.
- [ ] **Latency Simulation**: Test how the "Slingshot" feel holds up with 100ms+ ping.

## 🔴 Phase 3: Turn & Authority Testing
Testing the fairness and security of the simultaneous turn system.

- [ ] **Action Integrity**: Ensure Player A cannot send actions on behalf of Player B.
- [ ] **Timer Enforcement**: Server ignores actions sent after the 30s turn window has closed.
- [ ] **Collision Consistency**: Ensure collisions are calculated identically for all connected clients.
- [ ] **Edge Case: Disconnect during turn**: How does the server handle a player who disconnects while their action is "Locked In"?

## 🛰️ Phase 4: Stress & Network Testing
- [ ] **Max Player Capacity**: Test 8 players launching entities simultaneously. This will entail repeating tests in phase 1 & 2 but for 8 players.
- [ ] **Docker Deployment**: Verify performance matches local dev when running inside the container.
- [ ] **Mobile/Touch Input**: Verify the slingshot mechanic works on touchscreens (Canvas event listeners).

---

## Testing Log
| Date | Scenario | Status | Notes |
| :--- | :--- | :--- | :--- |
| 2026-01-28 | Victory Condition | ✅ PASS | Player 2 hub removed, Overlay shown. |
| 2026-01-28 | Draw Condition | ⏹️ SKIP | Requires 2-player input orchestration. |
