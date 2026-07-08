# Explosion Graphic Redesign Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Redesign the basic explosion graphic into a dynamic, multi-layered vector animation with concentric expanding shockwaves and radiating spark particles.

**Architecture:** We track the visual entity's spawn time on the client side in `useVisualInterpolation.js`. The renderer in `EntityRenderer.js` uses this to calculate progress and draw procedural concentric vector shockwaves and deterministic seeded random sparks using canvas draw operations.

**Tech Stack:** HTML5 Canvas, React, Vitest

---

### Task 1: Track Spawn Time and Sync Duration

**Files:**
- Modify: `shared/GameState.js`
- Modify: `client/src/hooks/useVisualInterpolation.js`
- Test: `client/src/hooks/useVisualInterpolation.test.js`

**Step 1: Write the failing test**
In `client/src/hooks/useVisualInterpolation.test.js`, add a test to verify `spawnTime` is stored when an entity is initialized:
```javascript
    it('should assign spawnTime to newly added visual entities', () => {
        const { result } = renderHook(() => useVisualInterpolation());
        const state = {
            turn: 1,
            phase: 'PLANNING',
            map: { width: 2000, height: 2000 },
            entities: [{ id: 'expl-1', type: 'EXPLOSION', x: 100, y: 100, radius: 40 }],
            links: [],
            audibleEvents: []
        };
        result.current.updateInterpolation(state, 'player1');
        const entity = result.current.visualEntities.current['expl-1'];
        expect(entity.spawnTime).toBeTypeOf('number');
        expect(entity.spawnTime).toBeLessThanOrEqual(Date.now());
    });
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run client/src/hooks/useVisualInterpolation.test.js`
Expected: FAIL due to `spawnTime` being undefined on the entity.

**Step 3: Write minimal implementation**
1. In `shared/GameState.js` under `snapshots.push({ ... })` (around line 1347), add serialization for `duration` and `maxDuration` inside the `tempVisuals` mapping:
```javascript
                                    ...tempVisuals.map((v) => ({
                                        id: `viz-${Math.random()}`,
                                        type: v.type,
                                        itemType: v.itemType,
                                        x: v.x,
                                        y: v.y,
                                        radius: v.radius,
                                        targetX: v.targetX,
                                        targetY: v.targetY,
                                        duration: v.duration,
                                        maxDuration: v.maxDuration || v.duration || 40
                                    }))
```
2. In `client/src/hooks/useVisualInterpolation.js` under the initialization of a new visual entity:
```javascript
                visualEntities.current[serverEnt.id] = {
                    ...serverEnt,
                    isGhost: false,
                    lastSeen: Date.now(),
                    scouted: serverEnt.scouted,
                    spawnTime: Date.now()
                };
```

**Step 4: Run test to verify it passes**
Run: `npx vitest run client/src/hooks/useVisualInterpolation.test.js`
Expected: PASS

**Step 5: Commit**
```bash
git add shared/GameState.js client/src/hooks/useVisualInterpolation.js client/src/hooks/useVisualInterpolation.test.js
git commit -m "feat: serialize duration and track explosion spawnTime"
```

---

### Task 2: Implement Dynamic Renderer for Explosion

**Files:**
- Modify: `client/src/components/canvas/EntityRenderer.js`

**Step 1: Write minimal implementation**
1. Implement a seeded random helper inside `client/src/components/canvas/EntityRenderer.js`:
```javascript
function getSeededRandom(seedString) {
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
        hash = seedString.charCodeAt(i) + ((hash << 5) - hash);
    }
    return () => {
        const x = Math.sin(hash++) * 10000;
        return x - Math.floor(x);
    };
}
```
2. Update the `entity.type === 'EXPLOSION'` renderer block to render concentric circles and radiating sparks dynamically:
```javascript
        } else if (entity.type === 'EXPLOSION') {
            const explosionRadius = entity.radius || 40;
            const vStats = VISUAL_STATS[entity.itemType] || {};
            const baseColor = vStats.color || '#ff9900';
            
            // Calculate animation progress
            const maxDuration = entity.maxDuration || 40;
            const durationMs = maxDuration * 60; // 60ms per subtick
            const age = Date.now() - (entity.spawnTime || Date.now());
            const progress = Math.min(1.0, Math.max(0.0, age / durationMs));
            
            // Fast initial expansion curve
            const pFast = Math.pow(progress, 0.3);
            const pSlow = Math.pow(Math.max(0, progress - 0.15), 0.4);
            const alpha = Math.max(0, 1 - Math.pow(progress, 1.5));
            const lineWidth = Math.max(0.5, 3 * (1 - progress));
            
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.shadowBlur = 15;
            ctx.shadowColor = baseColor;
            
            // 1. Primary Shockwave Ring
            ctx.beginPath();
            ctx.arc(entity.x, entity.y, explosionRadius * pFast, 0, Math.PI * 2);
            ctx.strokeStyle = baseColor;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
            
            // 2. Secondary Shockwave Ring (delayed)
            if (progress > 0.15) {
                ctx.beginPath();
                ctx.arc(entity.x, entity.y, explosionRadius * 0.7 * pSlow, 0, Math.PI * 2);
                ctx.strokeStyle = baseColor;
                ctx.lineWidth = lineWidth * 0.6;
                ctx.stroke();
            }
            
            // 3. Seeded sparks radiating outward
            const rand = getSeededRandom(entity.id || 'expl');
            const sparkCount = 14;
            for (let i = 0; i < sparkCount; i++) {
                const angle = rand() * Math.PI * 2;
                const speed = 0.5 + rand() * 0.7;
                // Drag distance formula: maxRadius * (1.2 * (1 - e^(-5p))) * speed multiplier
                const maxDist = explosionRadius * 1.3 * speed;
                const currentDist = maxDist * (1 - Math.exp(-5 * progress));
                
                const startX = entity.x + Math.cos(angle) * (currentDist - 6 * (1 - progress));
                const startY = entity.y + Math.sin(angle) * (currentDist - 6 * (1 - progress));
                const endX = entity.x + Math.cos(angle) * currentDist;
                const endY = entity.y + Math.sin(angle) * currentDist;
                
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.strokeStyle = baseColor;
                ctx.lineWidth = Math.max(0.5, 1.5 * (1 - progress));
                ctx.stroke();
            }
            
            ctx.restore();
```

**Step 2: Run verification**
Run: `npm run test` to verify everything compiles and all tests pass.
Expected: PASS

**Step 3: Commit**
```bash
git add client/src/components/canvas/EntityRenderer.js
git commit -m "feat: implement dynamic concentric shockwave and spark rendering for explosions"
```
