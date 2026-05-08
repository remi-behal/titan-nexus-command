# Shield Dome & Nuke Visual Refinement Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Decouple shield barrier warnings from the generator structure and move them to the dome, and refine Nuke pulsing behavior.

**Architecture:** Update `ShapeRenderer.js` to support warning states for fields, and refactor `GameBoard.jsx` to separate health-based and barrier-based visual feedback.

**Tech Stack:** React, HTML5 Canvas API

---

### Task 1: Update drawField in ShapeRenderer.js

**Files:**
- Modify: `client/src/utils/ShapeRenderer.js`

**Step 1: Add isWarning parameter to drawField**
Update the signature and implement high-frequency alpha oscillation (flicker) for fields.

```javascript
// client/src/utils/ShapeRenderer.js

export const drawField = (ctx, x, y, shapeKey, radius, color, isGhost = false, time = Date.now(), coneAngle = 60, currentAngle = 0, isWarning = false) => {
    // ...
    let alpha = isGhost ? 0.2 : 0.6;
    if (isWarning && !isGhost) {
        // Match drawShape's flicker logic
        const flicker = Math.sin(Date.now() / 40) > 0 ? 1.0 : 0.4;
        alpha *= flicker;
    }
    ctx.globalAlpha = alpha;
    // ...
}
```

**Step 2: Commit**
```bash
git add client/src/utils/ShapeRenderer.js
git commit -m "feat(renderer): add isWarning support to drawField"
```

---

### Task 2: Refactor Shield Rendering in GameBoard.jsx

**Files:**
- Modify: `client/src/components/GameBoard.jsx`

**Step 1: Decouple Shield warnings**
Separate `structureWarning` (HP) from `domeWarning` (barrierHp) in the `SHIELD` rendering block.

**Step 2: Update drawField calls**
Ensure all `drawField` calls pass the new `isWarning` parameter (defaulting to `false` for non-critical fields).

```javascript
// client/src/components/GameBoard.jsx:962 (approx)

if (entity.type === 'SHIELD') {
    const structureWarning = entity.hp <= 1;
    const domeWarning = entity.barrierHp !== undefined && entity.barrierHp <= 1;
    
    drawShape(ctx, entity.x, entity.y, shapeKey, radius, color, 0, displayAsGhost, structureWarning);
    
    if (entity.barrierHp > 0 && !isDisabled) {
        drawField(ctx, entity.x, entity.y, 'SHIELD_DOME', ENTITY_STATS.SHIELD.range, '#00ffff', displayAsGhost, Date.now(), 60, 0, domeWarning);
    }
}
```

**Step 3: Commit**
```bash
git add client/src/components/GameBoard.jsx
git commit -m "feat(ui): move shield barrier warning to dome"
```

---

### Task 3: Refine Nuke Visuals in GameBoard.jsx

**Files:**
- Modify: `client/src/components/GameBoard.jsx`

**Step 1: Replace expand/contract with flashing**
Remove `pulseScale` from the Nuke rendering block and use `isWarning` instead.

```javascript
// client/src/components/GameBoard.jsx:983 (approx)

// Replace pulseScale logic with isWarning
const pulseSpeed = isDetonating ? 50 : isCritical ? 150 : 300;
const nukeWarning = Math.sin(Date.now() / pulseSpeed) > 0;

// 1. Aura (flicker via drawField)
drawField(ctx, 0, 0, 'SHIELD_DOME', radius * 2.2, isDetonating ? '#ff0000' : '#f1c40f', displayAsGhost, Date.now(), 60, 0, nukeWarning);

// 2. Main Body (flicker via drawShape)
drawShape(ctx, 0, 0, 'NUKE_FLYING', radius, isDetonating ? '#ff0000' : '#f39c12', 0, displayAsGhost, nukeWarning);
```

**Step 2: Commit**
```bash
git add client/src/components/GameBoard.jsx
git commit -m "feat(ui): change nuke pulse to flashing/flickering"
```

---

### Task 4: Verification

**Step 1: Browser Verification**
- Deploy a Shield and damage it to 1 barrier HP. Verify dome flickers.
- Deploy a Nuke and wait for it to land. Verify it flashes instead of expanding/contracting.
