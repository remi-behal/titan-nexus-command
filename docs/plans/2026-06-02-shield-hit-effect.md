# Shield Hit Effect Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Replace the standard white projectile impact `'SPARK'` visual effect with the dedicated cyan spiky `'SHIELD_HIT'` visual effect when a shield blocks an incoming projectile.

**Architecture:**
1. **Server-Side Collision (`CollisionSystem.js`)**: Update the collision system to push a `'SHIELD_HIT'` visual effect to the game's temporary visuals queue upon successful shield interception.
2. **Client-Side Rendering & Audio**: The client-side visual interpolation hooks and canvas renderer already have robust configurations for `'SHIELD_HIT'`. Pushing `'SHIELD_HIT'` from the server will automatically render the cyan spiky burst and trigger the single correct shield hit sound effect (`playShieldHit`).
3. **Unit Tests (`Shield.test.js`)**: Update the shield collision test assertion to expect a `'SHIELD_HIT'` instead of `'SPARK'`.
4. **Roadmap (`tasks.md`)**: Mark task checklist item `#100` as completed.

**Tech Stack:** JavaScript (ES Modules), Vitest (Testing), Canvas API (Rendering).

---

### Task 1: Update Shield Collision Unit Tests

**Files:**
- Modify: `shared/tests/Shield.test.js:41-45`

**Step 1: Write the failing test change**

Update the test in `shared/tests/Shield.test.js` to assert on `'SHIELD_HIT'` instead of `'SPARK'`.

```javascript
                const proj = s.state.entities.find(e => e.itemType === 'WEAPON' && e.owner === 'player2');
                const shieldHit = s.state.entities.find(e => e.type === 'SHIELD_HIT');
                // The projectile might exist in one sub-tick and then be gone from the list in the next if it's inactive
                if (shieldHit) blocked = true;
                if (proj && !proj.active) blocked = true;
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run shared/tests/Shield.test.js`
Expected: FAIL (as `'SHIELD_HIT'` is not yet spawned by the server).

**Step 3: Commit**

```bash
git add shared/tests/Shield.test.js
git commit -m "test(shield): update unit test assertions to look for SHIELD_HIT"
```

---

### Task 2: Update Collision System Logic

**Files:**
- Modify: `shared/systems/CollisionSystem.js:76-83`

**Step 1: Implement minimal code to make test pass**

Update the temporary visuals pushed during shield blocks from `'SPARK'` to `'SHIELD_HIT'`.

```javascript
                // Visual effect
                tempVisuals.push({
                    type: 'SHIELD_HIT',
                    x: proj.currX,
                    y: proj.currY,
                    duration: 15
                });
```

**Step 2: Run test to verify it passes**

Run: `npx vitest run shared/tests/Shield.test.js`
Expected: PASS.

**Step 3: Commit**

```bash
git add shared/systems/CollisionSystem.js
git commit -m "feat(shield): replace SPARK visual effect with SHIELD_HIT on interception"
```

---

### Task 3: Roadmap Progress Update

**Files:**
- Modify: `.agents/tasks.md:99`

**Step 1: Mark checklist item complete**

Update the checkbox for the shield hit effect task in `.agents/tasks.md` from `[ ]` to `[x]`.

```markdown
        - [x] Shield needs a hit effect (spark is for projectile, shield needs some visual feedback too). Revisit later <!-- id: 100 -->
```

**Step 2: Commit**

```bash
git add .agents/tasks.md
git commit -m "docs: mark shield hit effect task as completed"
```
