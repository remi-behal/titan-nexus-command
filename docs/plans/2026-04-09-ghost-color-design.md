# Design Doc: Player Color Visibility for Ghosts (id: 93)

## Goal
Improve the visibility of player ownership for "ghost" structures (previously scouted entities that are currently out of vision).

## Current State
- Ghosts are rendered with 10% saturation for HSL colors.
- Fallback color for non-HSL is `#888` (light gray).
- Transparency is set to `globalAlpha = 0.4` for entities and `0.2` for links.
- Result: It is difficult to distinguish which player owns a ghosted structure.

## Proposed Changes
### Visual Strategy: Increased Saturation
We will increase the saturation of ghost colors to a level that preserves color identity while still feeling "desaturated" compared to active entities.

1.  **Introduce Constants**: Define `GHOST_SATURATION` and `GHOST_TRANS_ALPHA` in `VisualStats.js` or directly in `GameBoard.jsx`.
2.  **Saturation Adjustment**: Update the regex replacement in `GameBoard.jsx` to use a higher saturation (e.g., 35%).
3.  **Entity Rendering**:
    - Update `displayAsGhost` logic to use the new saturation.
    - Maintain existing alpha (0.4) or slightly adjust if needed for clarity.
4.  **Link Rendering**:
    - Update `ghostColor` calculation for links to match the entity saturation.
    - Ensure dashed lines are preserved for ghost segments.

## Success Criteria
- Players can visually identify the player color of a ghosted structure at a glance.
- Ghosts still look distinct from active entities (via desaturation, transparency, and/or dashed patterns).

## Implementation Details
### GameBoard.jsx
- Replace hardcoded `10%` with a variable or constant.
- Recommended Saturation: `35%`.

```javascript
// Example change
const GHOST_SATURATION = '35%';
color = color.replace(/(\d+)%/, GHOST_SATURATION);
```

### Verification Plan
- Manual testing in a local server with multiple players.
- Scout an enemy hub, then move away and observe the ghosted color.
- Verify both the entity and the associated links show the distinct player color.
