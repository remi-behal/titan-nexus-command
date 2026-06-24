# Design: Cloaking Field Structure

Technical design for a new offensive/support structure that provides a 300px "shimmer" bubble, hiding all friendly structures from enemy view.

## Overview
The Cloaking Field acts as a tactical "fog generator." It creates a zone where structures are invisible to the enemy unless they are very close (25px), forcing manual scouting and preventing automated targeting.

## Architecture
### [NEW] `ENTITY_STATS.CLOAKING_FIELD`
- **hp**: 2
- **cost**: 60
- **vision**: 150
- **cloakRange**: 300
- **detectionRange**: 25
- **speed**: SPEED_TIERS.SLOW (for landing phase)
- **energyGen**: 0
- **Always On**: No energy maintenance cost.
- **EMP Sensitive**: Field vanishes if the structure is hit by EMP.

## Simulation Logic
### 1. Visibility Filtering (`GameState.getVisibleState`)
- Modify `isVisible(x, y)` to handle cloaking.
- If a target entity is within 300px of a non-disabled `CLOAKING_FIELD` owned by a different player than the observer:
    - The entity is ONLY visible if the observer has a vision source (hub, projectile, etc.) within 25px of that entity.
- **Link Continuity**: Links connected to cloaked structures will also use this 25px detection check for their endpoints and segments.

### 2. Seeker/Homing logic (`GameState.updateSeekerProjectile`)
- Projectiles (Homing Missiles, Interceptors) will ignore cloaked targets during their search phase.
- If a locked target enters a Cloaking Field, the lock is lost if the projectile is > 25px away.

### 3. Ghost Memory Persistence
- No logic changes required in `GameBoard.jsx`. 
- By filtering the entity out of the server state, the client naturally retains the "Ghost" icon in the fog.
- When vision returns to the spot, the server returns "no entity," and the client will automatically wipe the stale ghost icon.

## Visual Design
### [MODIFY] `GameBoard.jsx`
- **Owned Cloaking Fields**: Render a standard, faint range circle (alpha 0.2) showing the 300px boundary.
- **Enemy Cloaking Fields**: 
    - **No persistent color**.
    - **Intermittent Shimmer**: Once every 5 seconds, apply a slight "wavy" canvas displacement or noise effect to the 300px area.

## Verification Plan
### Automated Tests
- `server/cloaking.test.js`: Verify that entities within 300px are filtered out of `getVisibleState` for enemy players.
- `server/cloaking.test.js`: Verify homing missiles skip cloaked targets.
- `server/emp_interaction.test.js`: Verify EMP strike on Cloaking Field reveals contents.

### Manual Verification
- Deploy Cloaking Field and verify that friendly structures disappear from a second client window.
- Verify the intermittent "shimmer" effect on enemy fields.
