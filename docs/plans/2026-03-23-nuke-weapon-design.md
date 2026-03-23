# Design Doc: The Nuke Weapon

## Overview
The Nuke is a high-cost, high-risk, high-reward strategic weapon in **Titan: Nexus Command**. It is launched like a structure but serves as a localized, delayed explosion that can devastate clustered enemy setups.

## Strategic Goal
To provide a counter-play option for "turtle" strategies and to introduce a high-stakes objective that requires prioritization for both the attacker and defender.

## Specifications

### Stats
- **Entity Identification**: `NUKE`
- **Class**: Structure
- **Launch Cost**: 100 Energy
- **Health**: 5 HP
- **Impact HP**: 1 HP (Undeployed phase)
- **Speed**: SLOW
- **Damage (Full)**: 10 (Within 200px)
- **Damage (Half)**: 5 (Within 400px)
- **Explosion Radius**: 200px (Full) / 400px (Half)
- **Vision**: 200px (while active)

### Mechanics

#### 1. Launch & Deployment
The Nuke is launched from a Hub using the standard slingshot mechanic. It travels at the SLOW speed tier. Upon landing, it goes through the standard deployment sequence (Undeployed -> Deployed).

#### 2. The 2-Turn Fuse
- **Initialization**: When the Nuke completes its deployment at the end of Turn 1, a `detonationTurn` property is set to `currentTurn + 2`.
- **Active State**: During Turn 2, the Nuke exists on the map as a structure owned by the player. It can be targeted and destroyed by enemy weapons or defenses.
- **Detonation Phase**: At the start of Turn 3 (during the Planning Phase transition), the GameState checks for any Nuke entities whose `detonationTurn` matches the `currentTurn`.

#### 3. Detonation vs. Defusal
- **Detonation**: If the Nuke's timer reaches 0, it triggers an explosion at its location.
    - All structures within 400px take damage according to the proximity falloff. 
    - The Nuke entity is removed.
- **Defusal**: If the Nuke's HP reaches 0 before the `detonationTurn` is reached, it is removed from the game.
    - **Crucially**: It does NOT trigger an explosion when defused.

## Visual Feedback
- **Countdown**: A numeric countdown badge (2, then 1) is displayed over the Nuke structure.
- **Indicator**: A red hazard light effect while the fuse is active.
- **AOE Preview**: A desaturated circle showing the potential impact zone is visible to the owner during planning.

## Edge Cases
- **Friendly Fire**: The Nuke treats all structures equally. Players must be careful not to nuke their own links.
- **Map Wrapping**: AOE damage must correctly calculate distances across the toroidal map boundaries.
- **Simultaneous Turns**: If two Nukes land in the same spot, both are destroyed (Structure Overlap rule) and neither explodes.
