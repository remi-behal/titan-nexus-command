---
description: how to run automated tests for the game logic
---

This workflow runs the automated test suite for **Titan: Nexus Command**. Tests focus on the core game engine (`shared/GameState.js`) to validate physics, turn resolution, and win conditions.

### Steps

// turbo
1. **Run All Tests**
   Execute the full test suite with coverage reporting.
   ```bash
   npm test
   ```

// turbo
2. **Run Tests in Watch Mode** (Development)
   Automatically re-run tests when files change.
   ```bash
   npm run test:watch
   ```

// turbo
3. **Run Tests with UI** (Interactive)
   Open the Vitest UI for interactive test exploration.
   ```bash
   npm run test:ui
   ```

### What Gets Tested

#### Unit Tests (`shared/GameState.test.js`)
- **Slingshot Math**: Power curve calculations and clamping
- **Toroidal Wrapping**: Coordinate wrapping and distance calculations
- **Link Integrity**: Orphaned structure detection and cleanup
- **Turn Resolution**: Energy costs, fuel consumption, collision detection
- **Win Conditions**: Single winner, draw, and elimination logic

#### Integration Tests (Future)
- Server-side action validation
- Socket.io event handling
- Multi-player turn synchronization

### When to Use
- Before committing changes to `shared/GameState.js`
- After implementing new game mechanics
- When debugging unexpected behavior in turn resolution
- As part of CI/CD pipeline (future)

### Notes
- **Manual playtesting is still essential!** These tests validate logic, not game feel.
- Tests run in Node.js (no browser required) for speed.
- Coverage reports are generated in `coverage/` directory.
