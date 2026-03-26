# Design: Echo Artillery

## Overview
The **Echo Artillery** is a specialized defense/counter-offensive structure. It uses sound-based tracking to detect enemy launches and retaliates with an automated, slightly inaccurate barrage after a 1-turn delay.

## Mechanics

### 1. Detection (Sound-Based)
- **Range**: 800px radius.
- **Trigger**: Any enemy structure within range that performs a `launch` action.
- **Rule**: Bypasses Fog of War. The Artillery "hears" the launch even if the source hub is not currently visible to the player.

### 2. Response (Delayed Echo)
- **Timing**: 1-turn delay. If a launch is detected in Turn $N$, the Echo Artillery fires in the Resolution Phase of Turn $N+1$.
- **Target**: The exact coordinates of the source structure that performed the launch.
- **Frequency**: At most **once per turn**. If multiple launches occur within range, it only echoes the *first* one detected.

### 3. Inaccuracy (Angular Deviation)
- **Deviation**: The shot deviates from the "perfect" path by a random angular offset ($\pm 15^{\circ}$) and a random power variation ($\pm 10\%$).
- **Scaling**: Inaccuracy naturally increases with distance, making it much more accurate at close range than at max range.

## Stats
- **Build Cost**: 30 Energy.
- **Health**: 2 HP.
- **Payload**: Standard Dumb Bomb (2 DMG, standard splash).
- **Type**: Structure (Static).
- **Vision**: 200px (Artillery itself provides limited standard vision).

## Visuals
- **Color Palette**: Industrial Grey / Warning Orange.
- **Appearance**: A heavy, boxy turret with sound-dampening plates and a large directional microphone sensor.
- **Effect**: A low-frequency "thump" sound upon firing, with an orange muzzle flash.

## Technical Considerations
- **Turn State**: `GameState` will need to track `pendingEchos` (launches that triggered this turn to fire next turn).
- **Toroidal Math**: Ensure range checks and firing angles account for map wrapping.
- **Simultaneous Resolution**: Ensure the Echo's Dumb Bomb is processed in the same way as player-launched weapons in `resolveTurn`.
