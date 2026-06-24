# Ghost Color Visibility Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Increase the saturation of ghost entities and links from 10% to 35% to make player ownership distinguishable in Fog of War.

**Architecture:** 
1. Move the ghost color calculation from `GameBoard.jsx` to a new utility function `getGhostColor` in `RenderingHelpers.js`.
2. Add a unit test for `getGhostColor` to verify the HSL transformation.
3. Update `GameBoard.jsx` and `VisualStats.js` to use the new utility and a centralized constant.

**Tech Stack:** JavaScript (React, Vitest for testing).

---

### Task 1: Setup Constants and Utility
**Files:**
- Modify: `client/src/constants/VisualStats.js`
- Modify: `client/src/utils/RenderingHelpers.js`

**Step 1: Add GHOST_SATURATION constant**
Add `GHOST_SATURATION: '35%'` to `VisualStats.js`.

**Step 2: Implement getGhostColor in RenderingHelpers.js**
```javascript
export const getGhostColor = (baseColor, saturation = '35%') => {
    if (!baseColor || !baseColor.startsWith('hsl')) return '#888';
    return baseColor.replace(/(\d+)%/, saturation);
};
```

### Task 2: Unit Testing Utility
**Files:**
- Modify: `client/src/utils/RenderingHelpers.test.js`

**Step 1: Write tests for getGhostColor**
```javascript
import { getGhostColor } from './RenderingHelpers';

describe('getGhostColor', () => {
    it('should transform highly saturated HSL to target ghost saturation', () => {
        expect(getGhostColor('hsl(0, 70%, 50%)', '35%')).toBe('hsl(0, 35%, 50%)');
    });
    it('should fallback to gray for non-HSL colors', () => {
        expect(getGhostColor('#ff0000')).toBe('#888');
    });
});
```

**Step 2: Run tests**
Run: `npm test client/src/utils/RenderingHelpers.test.js`
Expected: PASS

### Task 3: Integration in GameBoard
**Files:**
- Modify: `client/src/components/GameBoard.jsx`

**Step 1: Import getGhostColor and VISUAL_STATS**
**Step 2: Replace hardcoded saturation logic for links (lines 462-466)**
**Step 3: Replace hardcoded saturation logic for entities (lines 680-685)**

### Task 4: Verification
**Manual Verification:**
1. Start the game.
2. Scout an enemy hub (player 2).
3. Move your hub (player 1) away until the enemy hub becomes a ghost.
4. Verify the ghosted hub is clearly recognizable as the player 2 color (e.g., yellowish-grey vs deep grey).
