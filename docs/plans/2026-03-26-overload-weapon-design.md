# Design: Overload Weapon

## Overview
The **Overload** is a tactical weapon inspired by the "Virus" from Moonbase Commander. It targets the "energy network" (links) directly, dealing damage that propagates **downstream** from the impact point.

## Mechanics

### 1. Targeting & Collision
- **Type**: Standard Projectile (Interceptable).
- **Detection**: The weapon checks for collisions with both **Structures** and **Links** within a 30px radius upon landing.

### 2. Damage Propagation (Downstream Only)
- **Case A: Link Impact**
    - If a link $A \to B$ is hit (where $A$ is the source/upstream and $B$ is the target/downstream):
    - Structure **B** takes **1 Damage**.
    - Structure **A** is unaffected.
- **Case B: Structure Impact**
    - If Structure **A** is hit directly:
    - Structure **A** takes **1 Damage**.
    - **Transmission**: Every structure **B** connected via an outgoing link ($A \to B$) also takes **1 Damage**.
    - *Note: This is 1-hop only. Damage does not spread from B to its own children.*

## Stats
- **Launch Cost**: 40 Energy.
- **Health**: 1 (Interceptable).
- **Speed**: NORMAL (5 px/tick).
- **Size**: 10 (Render radius).
- **Damage**: 1 (Chain damage).

## Visuals
- **Color Palette**: Electric Purple / Cyan.
- **Effect**: A pulse of "glitchy" electricity that travels along the affected links to the downstream structures.

## Technical Considerations
- **Link Detection**: Use `GameState.getPointToSegmentDistance` to check if the landing point is near any link line.
- **Toroidal Awareness**: Link segments must be checked across wrapping boundaries.
- **Simultaneous Resolution**: Ensure that if multiple Overloads hit the same network, damage is applied correctly in the same round.
