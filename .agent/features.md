# Game Features Deep Dive

This document details the mechanics and vision for the game components of Titan Nexus Command.
**IMPORTANT**: Agent edits to this file should be minimal

## The Slingshot [Implemented]
*   **Direction**: Pull back *away* from the target. The further the pull, the higher the power.
*   **Non-Linear Tension**: Launch distance is non-linear relative to pull distance (e.g. exponential or power curve). This ensures that low-power launches are precise, while high-power launches are significantly more sensitive and difficult to master.
*   **Decoupled HUD**: The launch vector is an abstract **Power Gauge**, not a landing preview.
    *   **Pull Vector**: A dotted line showing the raw distance and direction of the mouse pullback.
    *   **Power Arrow**: A short, solid arrow pointing in the launch direction. Its length correlates slightly to the pull but does **not** indicate the landing spot.
    *   **Visual Feedback**: Power level is communicated through the arrow's **Color** (Green to Orange to Red gradient) and a subtle **Scaling** effect.
*   **Goal**: Physics should feel weighty and deliberate. Accuracy is a learned skill and a matter of intuition, rather than a calculated certainty provided by the UI.

### Interaction Model [Implemented]
The game follows a strict state machine for actions:
1. **Selection**: User clicks a Hub they own.
2. **Item Pick**: User selects an item type (Hub, Weapon, etc.) from a menu.
3. **Launch Mode**: User clicks "Launch".
4. **The Sling**: Click and drag on the **Sling Ring** around the Hub. 
    *   **Visuals**: A dotted line to the mouse and a color-coded "Power Arrow" in the opposite direction.
    *   **Clamping**: Maximum pull distance is enforced.
5. **Commit**: Releasing the mouse locks the action. The moment the mouse is released, the color-coded arrow is replaced by a frozen version colored with the release color and a small number (e.g., 1st action, 2nd action).
    *   **Landing Preview**: If the **show landing** toggle is active, "Greyed Out" actions are visible on the map.

## The Toroidal (Wrap) Map [Implemented]
*   **Topology**: The world is a finite rectangle (2000x2000) but without edges.
*   **Wrapping**: Moving off one edge brings you to the opposite side.
*   **Visualization**: The client renders 3x3 tiles of the map for seamless boundary viewing.
*   **Math**: Shortest-path aware coordinate systems are used for vision, distances, and targeting.

## Fog of War [Implemented]
*   **Active Vision**: Your structures provide a circular radius of visibility.
*   **Map Knowledge**: Static features (terrain, mining nodes) are permanently visible from the start of the game.
*   **The "Ghost" Layer**: If an enemy structure or link leaves your vision, its last known position remains visible as a desaturated "ghost." It only disappears or updates if a unit is sent to re-scout that area.

## Energy and Economy
*   **Generation**: Hubs and Extractors generate energy every turn.
*   **Costs**: Every launch consumes energy.
*   **Decision**: Players must balance expanding their network (Hubs) versus offensive capabilities (Weapons).
*   **Launch Fuel**: Hubs and some defenses have a fuel capacity. Launching from these structures consumes fuel.
    *   **Refueling**: If a structure runs out of fuel, it cannot launch until it is refueled to maximum capacity at the start of the next turn.
    *   **Visibility**: Fuel is only viewable on owned or allied structures.

## Structures and Link System
*   **Hubs**:
    *   Hubs are the only structures that can create links by launching other structures.
    *   Players start with a single "Starter Hub" which has more health and a unique appearance.
*   **Extractors**:
    *   Extractors generate energy every turn and can be launched from Hubs.
*   **Links**: 
    *   Links are created by launching structures from Hubs.
    *   All links must eventually connect back to the Starter Hub. If a structure cannot be reached via a link from the Starter Hub, it is destroyed.
    *   This can create chain reactions where losing a single Hub destroys a large portion of a network.
    *   Links currently feature an arrow indicating the direction back to the source Hub.
*   **Defenses**:
    *   Defenses are launched from Hubs and protect against incoming projectiles via interceptions.
    *   Some defenses may act passively in an offensive role against enemy structures (**TBD**).
    *   See `defenses.md` for more details

## Map Features
*   **Lakes**: Bodies of methane that cannot be built on; links cannot cross them.
*   **Mountains**: Obstacles that cannot be built on, though links *can* cross them.
*   **Energy Nodes**: Special locations that generate energy every turn. Extractors built on nodes generate additional energy.
*   **Super Energy Nodes**: Generate twice the energy of standard nodes. Located in competitive, hotly contested locations.
*   **Methane Rain Clouds (Dynamic Weather)**: Moving zones that reduce the lock-on range of all structures and weapons inside by 50%.
*   **High Winds (Dynamic Weather)**: A global effect lasting several turns. Pushes all launched items in the direction of the wind, affecting range accordingly.
*   **Strategic Locations**: TBD locations granting unique abilities or effects.

## Health and Combat
### Health System
*   **Health**: All structures have health. When health reaches zero, the structure is destroyed.
*   **Repair**: Health can be repaired (details **TBD**).
*   **Damage**: Damage is dealt by weapons and status effects.

### Weapons
*   **Function**: 
    *   Projectiles launched from Hubs to destroy enemy structures. 
    *   Weapons not part of link system and are not structures. 
    *   Weapons only last for one round and then destroyed.
*   **Types**: Kinetic, Guided, Status Effects, etc.
*   **Collisions**:
    *   Weapons do not collide with each other.
    *   Interceptions do not collide with each other.
*   **Targeting & IFF (Identification Friend or Foe)**:
    *   **Friendly Fire**: Projectiles can damage any structure they collide with.
    *   **Automated Systems**: Homing systems and automated defenses ignore friendly signatures when acquiring targets.

### Damage Types
*   Standard types include Kinetic, Energy, Explosive, and Status Effects.

## Technical Systems

### Physics
*   **TBD**

### Animations
*   **Movement**: Launches (structures, weapons, interceptions) are not instant; they move through the air to their destination.
*   **Sequence**: Launches have distinct launch, impact, and deployment animations.
*   **Round Execution**:
    1.  Launch animations
    2.  Intercept animations
    3.  Impact animations
    4.  Deployment animations
*   Additional animations **TBD**.
*   **Sub-tick Simulation [Implemented]**: Resolution processes actions in 120 sub-ticks for smooth, frame-by-frame animation snapshots.

### Structure Lifecycle & Deployment
*   **Three-State Lifecycle**: To facilitate variable flight speeds and visual weight, structures follow a distinct lifecycle:
    1.  **Launch Projectile**: The entity exists purely as a moving projectile with no functionality other than its vector.
    2.  **Undeployed Solid**: Upon "landing" at its destination (regardless of how much of the simulation round remains), the projectile is replaced by an undeployed version of the structure.
    3.  **Completed Structure**: Only after the action round enters its final **Deployment Phase** does the structure transition to its functional, high-HP form.
*   **Vulnerability Window**:
    *   **Low Integrity**: An undeployed structure has only **1 HP**. If hit by a weapon or intercepted before the round ends, it is destroyed instantly.
    *   **Dormant Logic**: Undeployed structures cannot perform actions (e.g., a Laser Defense cannot intercept while undeployed).
*   **Simultaneous Finalization**: All structures that survived the Action Phase "deploy" at the exact same time, ensuring a fair transition to the next turn's planning phase.

### Animations [Implemented]
*   **Lerp**: Client-side interpolation ensures smooth movement between server snapshots.
*   **Sequence**: Energy phase -> Action rounds -> Final state.

### Visuals, Audio, and UI
*   Visuals: **TBD**
*   Audio: **TBD**
*   UI: **TBD**

## Multiplayer Features
*   **Lobby**: Create or join lobbies, including a "Join Most Full" option.
*   **Team Play**: Teams share a common energy pool and can launch structures from any allied Hub.
*   **Chat**: Supported in lobbies and during gameplay.
*   **Private Lobbies**: Password-protected lobbies for private games.
*   **Spectator Mode**: Watch games and chat with players without participating.

## Turn Lifecycle

### 1. Planning Phase (Input)
*   **Initialization**: Global turn counter increments.
*   **Economy**: Active players receive energy income, and structure launch fuel is replenished.
*   **Orders**: Players queue actions (Launches), depleting energy and fuel per structure.
*   **Commitment**: Phase ends when all players "End Turn," run out of energy, or the timer hits zero.

### 2. Action Phase (Resolution)
Processed in sequential **Simultaneous Rounds**. The number of rounds is determined by the player with the most actions.

*   **Round Execution Loop**:
    1.  **Collection**: The server fetches the next available action for every player.
    2.  **Integrity Check**: If a source structure was destroyed in a previous round, the action is discarded, and the server pulls the *next* item in that player's queue for the same round.
    3.  **Simultaneous Launch**: All valid actions are processed at once.
    4.  **State Update**: Damage is applied, new structures are instantiated, and links are forged simultaneously.
*   **Termination**: Repeats until all action queues are empty.
*   **Display**: Players see the loop execute with a round counter and animation delays.
    *   **TODO**: Improve the "Resolution Overlay" to be less intrusive.

### 3. Launch and State Update Sequence
1.  **Path Calculation**: Weapons calculate paths. Homing weapons include a turning radius. Multiturn weapons calculate their trajectories. (**TODO**: Expand this section).
2.  **Interception Check**: Defenses check their range, calculate intercept points, and determine damage to weapons.
3.  **Damage Resolution**: Weapons calculate received damage from all interceptions (overdamage is possible). If destroyed, the point of destruction is determined, and animations are queued.
4.  **Impact Resolution**: If not intercepted, impact damage is calculated. Multiple structures may be hit; damage is applied in the order of impact.
5.  **Animation Execution**: Processed per the sequence in the Animations section.

#### Examples
*   **Example 1**: Weapon (2 HP) vs. two defenses (1 DMG, 2 DMG). Weapon is destroyed by the second interception.
*   **Example 2**: Weapon (2 HP) vs. three defenses (1 DMG each). Weapon is destroyed by the second interception; the third is ineffective.
*   **Example 3**: Weapon (2 HP) vs. two defenses (1 DMG each). Weapon reaches the target before the second interception can connect; second interception is ineffective.

### 4. Conflict Resolution (Work in Progress)
*   **Structure Overlap**: If two players land structures in the same location in the same round, both are destroyed.
*   **Interception of Structures**: Launched structures move through the air and can be intercepted. They have 1 HP while in flight, but normal HP once deployed.
*   **Autonomous Projectiles**: Once launched, weapons and interceptions are autonomous; they persist for that round even if their source Hub is destroyed in the same round.
*   **Post-Mortem Revenge**: If a player's last Hub is destroyed but they have projectiles "in flight," those projectiles finish their path before the player is eliminated.
*   **Defensive Overkill**: Defenses fire immediately. If a weapon is destroyed, subsequent interceptions may reacquire targets if they have homing capabilities.
*   **Link Decay**: Orphaned structures (lost link to Starter Hub) are destroyed at the end of the round. Scheduled launches from these structures still occur within that round.
*   **Target Ambiguity**: If a guided missile's target is destroyed by another player before arrival, it attempts to reacquire a target in range; otherwise, it flies straight until it impacts.
*   **Homing Commitment**: Close-range homing projectiles cannot reacquire targets once committed. (**TODO**: Define "Smart" vs. "Dumb" homing).

## Terminology
*   **Hierarchy**: Turn > Phase > Round.
*   **Example**: Turn 1, Planning Phase -> Turn 1, Action Phase, Round 1 -> Turn 1, Action Phase, Round 2 -> Turn 2, Planning Phase.

## Important Conventions
*   **Colors**: Hubs and entities are colored by their `owner`.
*   **Debug Mode**: Maintain the `showDebugPreview` toggle for testing math vs. visual skill.
