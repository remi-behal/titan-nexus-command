# Game Features Deep Dive

This document details the mechanics and vision for the game components.

## 🏹 The Slingshot
*   **Direction**: Pull back *away* from the target. The further the pull, the higher the power.
*   **Non-Linear Tension**: Launch distance is non-linear relative to pull distance (e.g. exponential or power curve). This ensures that low-power launches are precise, while high-power launches are significantly more sensitive and difficult to master.
*   **Decoupled HUD**: The launch vector is an abstract **Power Gauge**, not a landing preview.
    *   **Pull Vector**: A dotted line showing the raw distance and direction of the mouse pullback.
    *   **Power Arrow**: A short, solid arrow pointing in the launch direction. Its length correlates slightly to the pull but does **not** indicate the landing spot.
    *   **Visual Feedback**: Power level is communicated through the arrow's **Color** (e.g., Green to Orange to Red gradient) and a subtle **Scaling** effect.
*   **Goal**: Physics should feel weighty and deliberate. Accuracy is a learned skill and a matter of intuition, rather than a calculated certainty provided by the UI.

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
*   **Hubs**:
    * Hubs are the only structures that can create links by launching other structures.
    * Players start with a single "starter" hub. Starter Hub has more health and a unique appearance.
*   **Extractors**: Extractors generate energy every turn. Extractors can be launched from hubs.
*   **Links**: Links are created by launching structures from hubs. All links link back to the "starter" hub. If a stucture can't be reached by a link from the starter hub, it is destroyed. This can create chain reactions where a single well-placed shot can destroy a large portion of a player's network. Links for now should have an arrow indicating the link back to the launched from hub. Animations will be added later for this.
*   **Defenses**: Defenses are structures that can be launched from hubs. Defenses defend from incoming projectiles through the use of interceptions. Note: some defenses can act passively in a offensive role against enemy structures (Details TBD).

## Map Features
*   **Lakes**: Bodies of methane that cannot be built on, and links can not cross
*   **Mountains**: Mountains are obstacles that cannot be built on, but links can cross
*   **Energy nodes**: Energy nodes are special locations on the map that generate energy every turn. Extractors can be built on energy nodes to generate additional energy.
*   **Super Energy Nodes**: Like energy nodes except generate twice the energy. Located in competitve locations so they are hotly contested and difficult to defend.
*   **Methane Rain Clouds (Dynamic Weather)**: These are moving lock on range reducers. Reduces lock on range of all structures and weapons inside the cloud by 50%.
*   **High Winds (Dynamic Weather)**: Global effect that can take effect for a few turns. Pushes all launched items in the direction of the wind (reduce range against the wind, increase range with the wind).
*   **TBD Strategic locations granting abilities/effects**
*   **TBD**

## Health System
*   **Health**: All structures have health. When a structure's health reaches 0, it is destroyed. Health can be repaired (details TBD)
*   **Damage**: Damage is dealt by weapons and status effects. 

## ⚔️ Combat & Arsenal
### Weapons
* Weapons are projectiles that can be launched from hubs. Weapons are used to destroy enemy structures. 
* Weapon types:Kinetic, Guided, Status Effects,etc.
### Targeting & IFF Protocols
* **Friendly fire is possible**: Projectiles can hit anything they collide with.
* **IFF (Identification Friend or Foe)**: Homing systems and automated defenses automatically ignore friendly signatures when acquiring targets.
* **Weapon collision**: Weapons do not collide with eachother, they will pass through eachother.
* **Interception collision**: Interceptions do not collide with eachother, they will pass through eachother.
### Damage Types
* Kinetic, Energy, Explosive, Status Effects...

## Physics
*   **TBD**

## Animations
*   **Launches of structures, weapons and interceptions from defenses will not be instant, they will move through the air to their destination.**
*   **Launches of structures will have a launch animation, an impact animation and a deployment animation.**
*   **Animations execute during each round**
    1. Launch animations
    2. Intercept animations
    3. Impact animations
    4. Deployment animations
*   **More animationsTBD**

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
5. Execute animations (See Animations section above)

**EXAMPLE 1:** Weapon has 2 health. Weapon is first intercepted by a defense that does 1 damage, then it is intercepted by another defense that does 2 damage. Weapon is destroyed by 2nd interception. 

**EXAMPLE 2:** Weapon has 2 health. Weapon is first intercepted by a defense that does 1 damage, then it is intercepted by 2 other defenses that each do 1 damage. Weapon is destroyed by 2nd interception. 3rd interception is thus ineffective.Intercept points are calculated and animations are processed for weapon path, defense paths, intercept points and weapon destroyed point. Intercept point of 3rd interception is still calculated but defense path is straight lined.

**EXAMPLE 3:** Weapon has 2 health. Weapon is first intercepted by a defense that does 1 damage, then it is intercepted by another defense that does 1 damage. Weapon reaches target before 2nd interception reaches weapon. Interception 2 is thus ineffective. Intercept point of 2nd interception is still calculated but defense path is straight lined.



### ⚖️ 3. Conflict Resolution (Work in Progress)
*Drafting priority rules for simultaneous overlaps:*
*   **Structure vs. Structure**: If two players land structures in the same unoccupied location in a round, both structures are destroyed.
*   **Defense vs. Launched Structure**: Structures are launched through the air (just like weapons) and can be intercepted by defenses. Stuctures while in flight only have 1 health, after landing and deploying they have their normal health.
*   **Weapons/interceptions once launched** Weapons/interceptions once launched are automonous (if their hub/defense is destroyed in the same round, they will still continue on their path to their target)
*   **Post-Mortem Revenge** If a player's last remaining Hub is destroyed in a round of the Action Phase, but they had a Weapons/interceptions already "in flight", the weapons/interceptions finish their path and the the player is eliminated at the end of the round.
*   **Defensive Overkill** Defenses fire interceptions immediately as weapons enter their ranges. If a weapon is intercepted and destroyed, any subsequent interceptions on that weapon that would have occurred are either ineffective or may try to rehome on an additional weapon target (if interception is a homing missle for example).
*   **Link Decay**  Hub A is connected to Hub B. Hub A is destroyed and Hub B is now "orphaned" (no link to the starter hub). Hub B is only destroyed at the end of the round in which Hub A was destroyed, so Hub B's scheduled launches still occur. This logic also applies to links between hubs and defenses.
*   **Target Ambiguity** Guided Missile is fired and acquires a target. Before the missile arrives, a third player destroys that Hub with a kinetic bomb. Missile will attempt to acquire another target within range, otherwise will fly straight and then impact the ground when it runs out of fuel.
*   **Homing, too late to redirect** Homing type weapons and interceptions when within a certain close distance to target are committed, and can't acquire another target if the target is destroyed. (TODO, define multiple types of homing - e.g. "smart" homing that can reacquire targets, "dumb" homing that can't, etc)

## Terminoloy
* **Turn,phase,round** Hierarchy is turn > phase > round. 
**Example turn order:** Turn 1, Planning Phase -> Turn 1, Execution Phase, Round 1 -> Turn 1, Execution Phase, Round 2 -> Turn 2, Planning Phase etc.

## Important Conventions
- **Coordinates**: The map is a large coordinate system (e.g., 2000x2000). Camera/Pan logic will be needed later.
- **Colors**: Hubs and Entities should be colored by their `owner`.
- **Debug Mode**: Always maintain the `showDebugPreview` toggle to help with testing pinpoint math vs. visual skill.
