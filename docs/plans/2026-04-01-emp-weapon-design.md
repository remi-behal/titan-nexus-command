# EMP Weapon Design Spec

- **Date**: 2026-04-01
- **Status**: Approved
- **Topic**: EMP Weapon (Task #90)

## 1. Overview
The EMP (Electromagnetic Pulse) weapon is a tactical, non-destructive projectile designed to neutralize enemy infrastructure and shields for a limited time. It does not deal direct HP damage but disables functionality (firing, energy generation, and defensive capabilities).

## 2. Weapon Stats
- **Item Type**: `EMP`
- **Energy Cost**: 50
- **Radius**: 200px
- **Speed**: `SPEED_TIERS.NORMAL`
- **Interception**: Can be shot down by standard point-defenses (Lasers, SAMs, Flak).
- **Shield Interaction**: Detonates **immediately** upon impact with a shield barrier.

## 3. The "Disabled" Status
A new property `disabledUntilTurn` is added to the base entity structure.

### Duration
If hit in **Turn N**, the target is disabled for the remainder of Turn N and the entirety of Turn N+1.
- `entity.disabledUntilTurn = currentTurn + 2`
- The entity "unlocks" and becomes functional at the start of the **Planning Phase of Turn N+2**.

### Functional Impacts
- **Hubs**: No new launches permitted. Still relays power (Relay Only).
- **Extractors/Hubs**: Energy generation is skipped.
- **Defenses**: Automated firing (Search & Intercept) is disabled.
- **Shields**: The "Crossing Rule" logic is ignored (projectiles pass through). Barrier HP recharge is paused.
- **Nukes**: The `detonationTurn` countdown is paused (increments by 1 each turn the nuke is disabled).
- **Mid-Turn Interruption**: All remaining queued actions for a hub hit by an EMP are canceled immediately, and their energy cost is refunded to the player.

## 4. Visuals & UI
- **Visual Effect**: An animated "electrical glitch" or blue/yellow static flicker overlay is rendered over the structure in `GameBoard.jsx`.
- **UI**: Grayed out on the launch structure button if the player selects a disabled hub.

## 5. Technical Implementation
- Add `EMP` to `ENTITY_STATS.js`.
- Add `disabledUntilTurn` to `GameState.addEntity`.
- Update `GameState.resolveTurn` action collection for cancellation and refund.
- Update `GameState.resolveTurn` energy generation, defense firing, and shield recharge loops.
- Pass the `disabledUntilTurn` flag to the client in snapshots.
- Implement glitch rendering in `GameBoard.jsx`.

## 6. Verification Plan
- **Unit Tests**:
    - Verify `disabledUntilTurn` logic in `GameState.test.js`.
    - Verify shield-EMP detonation on barrier.
    - Verify nuke pausing.
    - Verify energy gen skip.
- **Integration Tests**:
    - Verify mid-turn cancellation and refund.
    - Verify visibility of glitch effect in client state.
