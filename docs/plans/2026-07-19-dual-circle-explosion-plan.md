# Dual-Circle Explosion Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Modify the explosion graphic to render a small solid core (white) expanding to 20% of full radius and a hollow outer ring (theme color) expanding to 100% of full radius, removing all sparks.

**Architecture:** Update the rendering block inside `EntityRenderer.js` under `entity.type === 'EXPLOSION'` to draw the solid core and outer ring with the defined progress-based scales, while removing the spark loop.

**Tech Stack:** HTML5 Canvas, Javascript

---

### Task 1: Update Explosion Renderer

**Files:**
- Modify: `client/src/components/canvas/EntityRenderer.js`

**Step 1: Write minimal implementation**
Replace the explosion rendering block in `client/src/components/canvas/EntityRenderer.js` with the new concentric dual-circle logic:
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
            
            // Scaled radii and alpha fade
            const pFast = Math.pow(progress, 0.2);
            const pOuter = Math.pow(progress, 0.4);
            const alpha = displayAsGhost ? 0.3 : Math.max(0, 1 - progress * progress);
            const lineWidth = Math.max(0.5, 3 * (1 - progress));
            
            ctx.save();
            ctx.globalAlpha = alpha;
            if (!displayAsGhost) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = baseColor;
            }
            
            // 1. Solid Core (White/Bright) expanding to 20% of max radius
            ctx.beginPath();
            ctx.arc(entity.x, entity.y, explosionRadius * 0.2 * pFast, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            
            // 2. Hollow Outer Ring expanding to full max radius
            ctx.beginPath();
            ctx.arc(entity.x, entity.y, explosionRadius * pOuter, 0, Math.PI * 2);
            ctx.strokeStyle = baseColor;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
            
            ctx.restore();
```

**Step 2: Run verification**
Run tests: `npm test -- --run`
Expected: PASS

**Step 3: Commit**
```bash
git add client/src/components/canvas/EntityRenderer.js
git commit -m "feat: implement dual-circle explosion graphic and remove sparks"
```
