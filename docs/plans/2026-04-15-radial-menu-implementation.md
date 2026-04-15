# Radial Menu Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Replace the current multi-step launch UI with a sleek, categorized radial menu on the hub.

**Architecture:** 
1. Categorize all structures in `EntityStats.js`.
2. Create an absolute-positioned `RadialMenu` React component.
3. Integrate menu with `App.jsx` and `GameBoard.jsx` for seamless selection and "Ready" state visualization.

**Tech Stack:** React, CSS (Glassmorphism), SVG, Canvas.

---

### Task 1: Update Entity Statistics with Categories

**Files:**
- Modify: `shared/constants/EntityStats.js`

**Step 1: Apply categories to all entities**
Add `category: "OFFENSE" | "DEFENSE" | "UTILITY" | "SPECIAL"` to each entity.

```javascript
// Example for WEAPON
WEAPON: {
    ...
    category: 'OFFENSE',
    ...
}
```

**Step 2: Run validation script**
Run: `node scripts/validate-stats.cjs`
Expected: "✅ All monitored stats are in sync." (Standard warnings about MD files are OK).

**Step 3: Commit**
```bash
git add shared/constants/EntityStats.js
git commit -m "feat: add categories to EntityStats"
```

---

### Task 2: Create RadialMenu Component

**Files:**
- Create: `client/src/components/RadialMenu.jsx`
- Create: `client/src/components/RadialMenu.css`

**Step 1: Implement RadialMenu UI**
Create a component that takes `x, y` (screen coords), `onSelect(type)`, `onCancel()`, and `categories`.
It should handle two states: `ROOT` (showing 4 categories) and `CATEGORY` (showing items in the selected category).

**Step 2: Add CSS for Radial layout**
Use CSS variables and calculated transforms to arrange items in a circle. Implement glassmorphism styles.

**Step 3: Commit**
```bash
git add client/src/components/RadialMenu.jsx client/src/components/RadialMenu.css
git commit -m "feat: implement RadialMenu base component"
```

---

### Task 3: Integrate RadialMenu into App.jsx

**Files:**
- Modify: `client/src/App.jsx`

**Step 1: Render RadialMenu overlay**
Render `RadialMenu` when `selectedHubId` is set and `!launchMode`. 
Convert hub's game coords to screen coords using canvas dimensions/camera.

**Step 2: Update selection logic**
Update `onSelect` to set `selectedItemType` and `launchMode = true`.
Update `onCancel` to set `selectedHubId = null`.

**Step 3: Commit**
```bash
git add client/src/App.jsx
git commit -m "feat: integrate RadialMenu into App"
```

---

### Task 4: Enhance Hub "Ready" Visuals in GameBoard

**Files:**
- Modify: `client/src/components/GameBoard.jsx`

**Step 1: Implement "North" Icon Rendering**
In the `isSelected` rendering block, if `launchMode` is active and an item is selected, draw its icon ~50px North of the Hub center.

**Step 2: Update coordinate occlusion**
Ensure clicks on the Radial Menu DOM elements don't trigger `handleMouseDown` on the canvas (e.g., calling `stopPropagation` in `RadialMenu`).

**Step 3: Commit**
```bash
git add client/src/components/GameBoard.jsx
git commit -m "feat: add north-offset icon to ready hub"
```

---

### Task 5: Cleanup Legacy UI

**Files:**
- Modify: `client/src/App.jsx`

**Step 1: Remove old dropdown and launch button**
Remove the `<select>` and `<button className="launch-btn">` from the header as they are now redundant.

**Step 2: Commit**
```bash
git add client/src/App.jsx
git commit -m "cleanup: remove legacy launch UI"
```

---

## Verification Plan

### Automated Tests
- Run `npm test` to ensure no regression in game logic.
- Run `npm run lint` to ensure code quality.

### Manual Verification
1. **Selection**: Click a Hub. Radial menu should appear.
2. **Navigation**: Click "Offense". Ring should swap to show Weapon, Nuke, etc.
3. **Locking**: Click "Nuke". Menu should close. Hub should show Nuke icon to the North.
4. **Launching**: Drag from the Hub center. Slingshot aiming should start. Release to launch.
5. **Cancellation**: Click "X" in menu center. Menu should close and hub deselect.
6. **Panning**: Drag outside items to pan. Menu should stay pinned to the Hub.
