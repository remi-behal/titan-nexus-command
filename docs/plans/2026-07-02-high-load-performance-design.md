# High-Load Performance & FPS Benchmarking Design

## Goal
Build a benchmark test suite that runs a simulation with 100+ active links and entities (nuclear hazard areas, projectiles, hubs) to measure engine sub-tick tick rates and Canvas frame rendering.

## Architecture & Components

### 1. High-Load Game State Initializer
A helper function that populates a `GameState` with:
- **20 Hubs**: 10 owned by `p1`, 10 owned by `p2`, distributed across the map.
- **40 Links**: Fully active connections between the hubs, crossing the toroidal map boundary.
- **10 Nuclear Hazard Areas (`EXPLOSION_HAZARD`)**: Persistent AOE fields on the map.
- **30 Projectiles (`WEAPON`, `NAPALM`, `CLUSTER_BOMB`, `HOMING_MISSILE`)**: Active moving projectiles mid-flight.

### 2. Canvas Context Mock
A stub implementation of standard Canvas 2D context methods (`save`, `restore`, `translate`, `scale`, `beginPath`, `arc`, `lineTo`, `moveTo`, `stroke`, `fill`, etc.) to track operation timing and invocation statistics without failing in headless Node/JSDOM.

### 3. Telemetry Reporter
A reporter that:
- Measures high-precision timing using `performance.now()`.
- Records sub-tick ticks during turn resolution (`GameState.resolveTurn()`).
- Records rendering frames by running the project's actual Canvas renderers (`drawEntities`, `drawLinks`, etc.) on the mock context.
- Formats and prints a clean ASCII summary table to the console.

## Testing Strategy
- Create a Vitest test under `shared/tests/HighLoadPerformance.test.js` containing the benchmark suite.
- Run the benchmark via standard `vitest` command to verify engine tick rates and canvas frame rendering.
