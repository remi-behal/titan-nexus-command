# Design Doc: Slingshot Safety System (Link Collision Prevention)

**Date**: 2026-04-30
**Topic**: Slingshot Safety
**Status**: Approved

## Goal
Implement a real-time warning and denial system that prevents players from launching a projectile if the resulting link would cross an existing or staged link originating from the **same source hub**.

## Constraints
1. **Scope**: Only check collisions against links from the same hub.
2. **Real-time**: Must provide immediate feedback during the aiming phase.
3. **Toroidal-aware**: Intersection logic must respect the map's world-wrapping.

## Proposed Design

### 1. Centralized Logic (`shared/GameState.js`)
We will add a static helper method to `GameState` to determine if a potential link segment intersects with any existing or staged links.

```javascript
static checkLinkIntersection(hub, targetX, targetY, existingLinks, stagedActions, map) {
    // 1. Calculate projected segments for the new link (targetX, targetY)
    // 2. Iterate through existingLinks and stagedActions
    // 3. Filter for links originating from the same hubId
    // 4. Decompose both into Euclidean segments
    // 5. Return intersection point or null
}
```

### 2. UI Warning (`client/src/components/GameBoard.jsx`)
In the `isAiming` block:
- Call `GameState.checkLinkIntersection`.
- If blocked:
    - Draw a floating text label "LINK CROSSING" near the hub.
    - Set a local `isBlocked` flag to `true`.

### 3. Denial & User Feedback (`client/src/App.jsx`)
In `handleAimEnd`:
- Re-validate the launch using the same helper.
- If `isBlocked`:
    - Skip adding the action to `committedActions`.
    - Trigger a 300ms `glitchActive` state.
    - Apply a `glitch-shake` CSS animation to the viewport for physical feedback.

### 4. CSS Animation (`client/src/App.css`)
Add a new keyframe animation for the glitch rejection.

```css
@keyframes rejection-glitch {
    0% { transform: translate(0); filter: hue-rotate(0deg); }
    25% { transform: translate(-2px, 2px); filter: hue-rotate(90deg); }
    50% { transform: translate(2px, -2px); filter: hue-rotate(180deg); }
    100% { transform: translate(0); filter: hue-rotate(0deg); }
}
```

## Verification Plan
1. **Manual Testing**:
    - Try to launch over an existing link from the same hub -> Expect warning and denial.
    - Try to launch over an existing link from a DIFFERENT hub -> Expect success.
    - Stage one action, then try to launch another crossing it from the same hub -> Expect warning and denial.
2. **Automated Testing**:
    - Update `GameState.test.js` to verify the static `checkLinkIntersection` helper logic.
