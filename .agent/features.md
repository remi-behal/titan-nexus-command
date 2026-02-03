# Game Features Deep Dive

This document details the mechanics and vision for the game components.

## 🏹 The Slingshot
*   **Direction**: Pull back *away* from the target. The further the pull, the higher the power.
*   **Feedback**: 
    *   Dotted line shows the "pull" vector.
    *   Solid Arrow shows the "launch" vector.
    *   Color transitions from Green (low power) to Red (max power).
*   **Goal**: Physics should feel weighty. Accuracy is a learned skill, not a calculated certainty.

## 🪐 The Toroidal (Wrap) Map
*   **Topology**: The world is a finite rectangle (e.g., 2000x2000) but without edges.
*   **Wrapping**: Moving off the right brings you to the left. Moving off the top brings you to the bottom. Moving off the bottom brings you to the top. Moving off the left brings you to the right.
*   **Visualization**: The client renders 3x3 tiles of the map to ensure that when looking at a corner, you see the "other side" filling in the space.

## 🌫️ Fog of War
*   **Active Vision**: Your structures provide a circular radius of visibility. 
*   **Map Knowledge**: Static features (terrain, mining nodes) are permanently visible from game start.
*   **The "Ghost" Layer**: If an enemy structure or link leaves your vision, its last known position remains visible as a desaturated "ghost." It only disappears or updates if you send a unit to re-scout that area.

## ⚡ Energy & Economy
*   **Generation**: Hubs and Extractors generate energy every turn.
*   **Costs**: Every launch consumes energy. 
*   **Decision**: Players must balance expanding their network (more Hubs) vs. attacking (more Weapons).

## Stuctures and Link system
*   **Hubs**: Players start with a single "starter" hub. Hubs are the only structures that can create links by launching other structures.
*   **Extractors**: Extractors generate energy every turn. Extractors can be launched from hubs.
*   **Links**: Links are created by launching structures from hubs. All links link back to the "starter" hub. If a stucture can't be reached by a link from the starter hub, it is destroyed. This can create chain reactions where a single well-placed shot can destroy a large portion of a player's network.
*   **Defenses**: Defenses are structures that can be launched from hubs. Defenses defend from incoming projectiles. Note: some defenses can act passively in a offensive role against enemy structures.

## Health System
*   **Health**: All structures have health. When a structure's health reaches 0, it is destroyed.
*   **Damage**: Damage is dealt by weapons and status effects. 

## Weapons
*   **Weapons**: Weapons are projectiles that can be launched from hubs. Weapons are used to destroy enemy structures. 
*   **Types**: 
    *   **Kinetic**: Dumb bombs that travel in a straight line. 
    *   **Guided**: Guided missiles that home in on enemy structures. 
    *   **Status Effects**: Disable. Does a small amount of damage and disables that structures abilities for a number of turns.
    *   **MORE WEAPONS TBD**

## Physics
*   **TBD**

## Animations
*   **Launches of structures and weapons will not be instant, they will move through the air to their destination.**
*   **TBD**

## Visuals
*   **TBD**

## Audio
*   **TBD**

## UI
*   **TBD**

## Multiplayer features
*   **Lobby**: Players can create and join lobbies. Join most full lobby also supported.
*   **Team Play**: Players can join team lobbies. Teams share a common pool of energy and can launch structures from any hub on their team.
*   **Chat**: Chat is supported in lobbies and in game.
*   **Private Lobbies**: Players can create private lobbies that are password protected.
*   
*   **Spectator Mode**: Players can join a lobby as a spectator. Spectators can watch the game and chat with other players.
*   **TBD**

## Interaction Model: The Slingshot
The game follows a strict state machine for actions:
1. **Selection**: User clicks a Hub they own.
2. **Item Pick**: User selects an item type (Hub, Weapon, etc.) from a menu.
3. **Launch Mode**: User clicks "Launch".
4. **The Sling**: Click + Drag *away* from the Hub.
   - **Visuals**: A dotted line to mouse, a color-coded "Power Arrow" in the opposite (launch) direction.
   - **Clamping**: Maximum pull distance is enforced (currently `MAX_PULL_DISTANCE = 300`).
5. **Commit**: Releasing the mouse locks the action. It appears "Greyed Out" on the map.

## Turn Lifecycle

### 🧠 1. Planning Phase (Input)
*   **Initialization**: Global turn counter increments.
*   **Economy**: All active players receive energy income.
*   **Orders**: Players queue up actions (Launches) depleting their available energy.
*   **Commitment**: The phase ends when all alive players "End Turn", when they have not enough energy for further actions or when the global timer hits zero.

### ⚔️ 2. Action Phase (Resolution)
The Action Phase is processed in sequential **Simultaneous Rounds**. The number of rounds is determined by the player with the most current valid actions.

*   **Round Execution Loop**:
    1.  **Collection (The Skip-and-Slide)**: The server fetches the next available action for every player.
    2.  **Integrity Check**: For each player, if the current action's source structure was destroyed in a previous round, that action is **discarded immediately**, and the server attempts to pull the *very next* item in that player's queue for the **same round**.
    3.  **Simultaneous Launch**: All valid "top of queue" actions are processed at once. (Further details discussed in Launch and State Update Sequence below)
    4.  **State Update**: Damage is applied, new structures are instantiated, and links are forged simultaneously. (Further details discussed in Launch and State Update Sequence below)
*   **Termination**: The loop repeats until all player action queues are empty.

**Launch and State Update Sequence**
1. Launch path is calculated. Weapons that are homing first calculate a small straight launch path then calculate a target and homing path (so homing weapons need a turning radius setup). Weapons that are multiturn calculate a path. (**TODO** expand this, it's ambiguous currently)
2. Defenses check if they can intercept the launch/weapon. Calculate intercept point and damage to weapon.
3. Weapons calculate recieved damage from all interceptions, (note overdamage is possible from multiple interceptions to a single weapon) if weapon is destroyed calculate where along path weapon is destroyed, apply all changes to the game state and process animations. Intercept points are calculated and animations are processed for weapon path, defense paths, intercept points, weapon survival, weapon destroyed point or weapon impact point. 
4. If weapon is not successfully intercepted, damage to impact point is calculated (multiple structures may be hit by a single weapon, damage is applied to each structure in the order they are hit). Apply all changes to the game state and process animations.

**EXAMPLE 1:** Weapon has 2 health. Weapon is first intercepted by a defense that does 1 damage, then it is intercepted by another defense that does 2 damage. Weapon is destroyed by 2nd interception. 

**EXAMPLE 2:** Weapon has 2 health. Weapon is first intercepted by a defense that does 1 damage, then it is intercepted by 2 other defenses that each do 1 damage. Weapon is destroyed by 2nd interception. 3rd interception is thus ineffective.Intercept points are calculated and animations are processed for weapon path, defense paths, intercept points and weapon destroyed point. Intercept point of 3rd interception is still calculated but defense path is straight lined.

**EXAMPLE 3:** Weapon has 2 health. Weapon is first intercepted by a defense that does 1 damage, then it is intercepted by another defense that does 1 damage. Weapon reaches target before 2nd interception reaches weapon. Interception 2 is thus ineffective. Intercept point of 2nd interception is still calculated but defense path is straight lined.



### ⚖️ 3. Conflict Resolution (Work in Progress)
*Drafting priority rules for simultaneous overlaps:*
*   **Hub vs. Hub**: If two players aim for the same unoccupied spot, [TBD: Both explode / Closest wins].
*   **Weapon vs. Hub**: Damage is applied before new structure instantiation in the same round.

## Important Conventions
- **Coordinates**: The map is a large coordinate system (e.g., 2000x2000). Camera/Pan logic will be needed later.
- **Colors**: Hubs and Entities should be colored by their `owner`.
- **Debug Mode**: Always maintain the `showDebugPreview` toggle to help with testing pinpoint math vs. visual skill.
