# Testing Strategy for Titan: Nexus Command

## Overview
This document outlines the testing approach for the game, balancing automated testing with essential manual playtesting.

## Philosophy
**Manual playtesting is irreplaceable** for a game. You need to feel the slingshot mechanic, judge the strategic depth, and experience the multiplayer dynamics. However, automated tests serve as a safety net to catch regressions in core logic.

## Current Test Coverage

### Unit Tests (`shared/GameState.test.js`)
**Coverage: 98.3%** of the game engine

The test suite validates:

#### 1. **Slingshot Math** (4 tests)
- Power curve calculations (non-linear scaling)
- Pull distance clamping to `MAX_PULL`
- Launch distance never exceeding `MAX_LAUNCH`
- Zero-pull edge case

#### 2. **Toroidal Map** (5 tests)
- X and Y coordinate wrapping (positive and negative)
- Shortest distance calculations across map edges
- Same-point distance (0)

#### 3. **Game Initialization** (3 tests)
- Player creation with starting energy
- Starter hub placement
- Unique color assignment

#### 4. **Link Integrity** (3 tests)
- Connected structures are preserved
- Orphaned structures are destroyed
- Chain reactions when intermediate links break

#### 5. **Turn Resolution** (5 tests)
- Energy generation at turn start
- Energy deduction for launches
- Fuel consumption and replenishment
- Turn counter incrementation

#### 6. **Win Conditions** (4 tests)
- Single winner declaration
- Draw condition (all players eliminated)
- No premature winner declaration
- Turn processing stops after winner

#### 7. **Collision Detection** (1 test)
- Weapon impact on enemy hubs

## Running Tests

### Quick Reference
```bash
# Run all tests with coverage
npm test

# Watch mode (auto-rerun on file changes)
npm run test:watch

# Interactive UI
npm run test:ui
```

See `.agent/workflows/test.md` for detailed workflow.

## What's NOT Tested (Intentionally)

### 1. **UI/UX** - Requires Manual Testing
- Slingshot "feel" and responsiveness
- Canvas rendering performance
- Visual feedback (power arrow, color gradients)
- Touch input on mobile devices

### 2. **Networking** - Future Integration Tests
- Socket.io event handling
- Multi-client synchronization
- Latency simulation
- Reconnection logic

### 3. **Game Balance** - Requires Playtesting
- Energy costs vs. generation rates
- Weapon damage vs. structure HP
- Turn timer duration (30s)
- Map size and starting positions

## When to Run Tests

### ✅ Always Run Before:
- Committing changes to `shared/GameState.js`
- Implementing new game mechanics
- Refactoring turn resolution logic
- Pushing to main branch

### ⚠️ Consider Running After:
- Debugging unexpected behavior
- Changing constants (costs, distances, etc.)
- Modifying collision detection

### ❌ Don't Bother Running After:
- UI-only changes (CSS, React components)
- Documentation updates
- Server-side event handler changes (until integration tests exist)

## Future Testing Roadmap

### Phase 1: Integration Tests (Server)
- [ ] Action validation (ownership, energy, fuel)
- [ ] Socket.io event handling
- [ ] Turn timer enforcement
- [ ] Multi-player turn synchronization

### Phase 2: End-to-End Tests
- [ ] Full game flow (lobby → game → victory)
- [ ] Multi-tab synchronization
- [ ] Disconnect/reconnect scenarios

### Phase 3: Performance Tests
- [ ] 8-player stress test
- [ ] Large entity count (100+ structures)
- [ ] Animation frame rate under load

## Test Maintenance

### Adding New Tests
When implementing a new feature in `GameState.js`:
1. Write the test first (TDD approach)
2. Ensure it fails initially
3. Implement the feature
4. Verify the test passes
5. Check coverage remains above 95%

### Updating Existing Tests
If you change game logic:
1. Update affected tests to match new behavior
2. Add new tests for edge cases introduced
3. Remove obsolete tests (if logic was removed)

## Notes
- Tests run in Node.js (no browser required) for speed
- Coverage reports are in `coverage/` directory (gitignored)
- Tests use Vitest (Vite-native test runner)
- All tests are isolated (no shared state between tests)
