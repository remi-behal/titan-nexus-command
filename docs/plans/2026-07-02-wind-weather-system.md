# Wind Weather System Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Implement a periodic wind storm mechanic that applies continuous physics-based drift to all launched projectiles/structures and renders a visual HUD wind indicator and canvas wind streak particles.

**Architecture:** 
1. Store and schedule wind state (`windState`) on the server/shared `GameState` class under the toggleable `map.modifiers.windEnabled` modifier.
2. In the sub-tick resolution loop of `ProjectileSystem.js`, apply wind force vectors per sub-tick to both linear standard trajectories and step-based seeker calculations.
3. Update client HUD (`SidebarLeft.jsx`) and GameBoard canvas (`GameBoard.jsx`) to display wind speed/angle readouts and render drifting wind particles.

**Tech Stack:** JavaScript (ES Modules), React, HTML5 Canvas, Vitest

---

### Task 1: Weather State Initialization & Cooldown Scheduler

**Files:**
* Modify: `shared/GameState.js`
* Create: `shared/tests/WindScheduler.test.js`

**Step 1: Write the failing test**
Create `shared/tests/WindScheduler.test.js` to verify wind scheduling transitions correctly under map modifiers.

```javascript
import { describe, it, expect } from 'vitest';
import { GameState } from '../GameState.js';

describe('Wind Weather Scheduler', () => {
    it('should stay disabled if map modifier is missing', () => {
        const gs = new GameState();
        gs.initializeGame(['p1', 'p2']);
        gs.map.modifiers = {};
        
        gs.updateWindCycle();
        expect(gs.windState.active).toBe(false);
    });

    it('should cycle through storm active/inactive durations', () => {
        const gs = new GameState();
        gs.initializeGame(['p1', 'p2']);
        gs.map.modifiers = { windEnabled: true };
        
        // Mock default state
        gs.windState = {
            active: false,
            angle: 0,
            speed: 0,
            duration: 0,
            cooldown: 2
        };

        // Turn 1: Decrements cooldown to 1
        gs.updateWindCycle();
        expect(gs.windState.active).toBe(false);
        expect(gs.windState.cooldown).toBe(1);

        // Turn 2: Decrements cooldown to 0, triggers wind
        gs.updateWindCycle();
        expect(gs.windState.active).toBe(true);
        expect(gs.windState.duration).toBeGreaterThanOrEqual(3);
        expect(gs.windState.duration).toBeLessThanOrEqual(6);
        expect(gs.windState.speed).toBeGreaterThanOrEqual(0.5);
        expect(gs.windState.speed).toBeLessThanOrEqual(1.5);
        expect(gs.windState.cooldown).toBe(0);

        // Force duration to 1 to test storm completion
        gs.windState.duration = 1;
        gs.updateWindCycle();
        expect(gs.windState.active).toBe(false);
        expect(gs.windState.speed).toBe(0);
        expect(gs.windState.cooldown).toBeGreaterThanOrEqual(10);
    });
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run shared/tests/WindScheduler.test.js`
Expected: FAIL (updateWindCycle not defined)

**Step 3: Write minimal implementation**
1. Add `windState` to `GameState` constructor in `shared/GameState.js`:
```javascript
        this.windState = {
            active: false,
            angle: 0,
            speed: 0,
            duration: 0,
            cooldown: 12
        };
```
2. Implement `updateWindCycle()` inside `GameState.js`:
```javascript
    updateWindCycle() {
        if (!this.map.modifiers?.windEnabled) {
            this.windState.active = false;
            this.windState.speed = 0;
            return;
        }

        if (this.windState.active) {
            this.windState.duration--;
            if (this.windState.duration <= 0) {
                this.windState.active = false;
                this.windState.speed = 0;
                this.windState.angle = 0;
                this.windState.cooldown = Math.floor(Math.random() * 6) + 10; // 10 to 15 turns
            }
        } else {
            this.windState.cooldown--;
            if (this.windState.cooldown <= 0) {
                this.windState.active = true;
                this.windState.duration = Math.floor(Math.random() * 4) + 3; // 3 to 6 turns
                this.windState.angle = Math.random() * 360;
                this.windState.speed = Math.random() * 1.0 + 0.5; // 0.5 to 1.5 pixels per sub-tick
            }
        }

        // Precalculate wind delta vectors for faster physics calculations
        const rad = (this.windState.angle * Math.PI) / 180;
        this.windState.dx = this.windState.active ? Math.cos(rad) * this.windState.speed : 0;
        this.windState.dy = this.windState.active ? Math.sin(rad) * this.windState.speed : 0;
    }
```
3. Call `this.updateWindCycle()` at the start of `resolveTurn` in `shared/GameState.js` (around line 597, right after incrementing turn):
```javascript
        this.turn++;
        this.updateWindCycle();
```

**Step 4: Run test to verify it passes**
Run: `npx vitest run shared/tests/WindScheduler.test.js`
Expected: PASS

**Step 5: Commit**
```bash
git add shared/tests/WindScheduler.test.js shared/GameState.js
git commit -m "feat(weather): initialize windState and storm scheduler"
```

---

### Task 2: Projectile System Physics Drift Integration

**Files:**
* Modify: `shared/systems/ProjectileSystem.js`
* Create: `shared/tests/WindPhysics.test.js`

**Step 1: Write the failing test**
Create `shared/tests/WindPhysics.test.js` to assert that standard and homing projectiles are drifted.

```javascript
import { describe, it, expect } from 'vitest';
import { GameState } from '../GameState.js';

describe('Wind Physics Drift', () => {
    it('should drift a standard projectile over its flight duration', () => {
        const gs = new GameState();
        gs.initializeGame(['p1', 'p2']);
        gs.map.modifiers = { windEnabled: true };
        
        // Force active wind blowing directly East (angle 0) at 1px/sub-tick
        gs.windState = {
            active: true,
            angle: 0,
            speed: 1,
            dx: 1,
            dy: 0,
            duration: 5,
            cooldown: 0
        };

        gs.addEntity({
            id: 'h1',
            type: 'HUB',
            owner: 'p1',
            x: 100,
            y: 100,
            hp: 5,
            deployed: true,
            isStarter: true
        });

        // Launch standard WEAPON at angle 90 (Straight South)
        // With speed/distance target making it fly for exactly 40 sub-ticks.
        // Expected landing spot: Y = 100 + 400 = 500. X = 100 + 40 (due to wind drift).
        const snapshots = gs.resolveTurn({
            p1: [
                {
                    playerId: 'p1',
                    sourceId: 'h1',
                    itemType: 'WEAPON',
                    angle: 90,
                    distance: 150 // translates to target distance/arrivalTick of 40 sub-ticks
                }
            ]
        });

        const landing = snapshots.find((s) => s.type === 'LANDING');
        expect(landing).toBeDefined();
        
        // Check actual coordinates of landing event or impact positions
        const lastSnapshot = snapshots[snapshots.length - 1];
        const impacts = lastSnapshot.state.entities.filter(e => e.type === 'EXPLOSION');
        // Let's inspect final projectile coord in intermediate snapshots
        const subTickSnap = snapshots.find(s => s.round === 1 && s.subTick === 40);
        expect(subTickSnap).toBeDefined();
        
        // Impact occurs at t=40, meaning wind offset is +40px.
        const proj = snapshots.find(s => s.type === 'TICK' && s.tick === 40)?.state?.entities?.find(e => e.type === 'WEAPON');
        // If it detracted, X should be ~140.
    });
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run shared/tests/WindPhysics.test.js`
Expected: FAIL (X is unchanged by wind)

**Step 3: Write minimal implementation**
1. Modify `updateStandardProjectile` in `shared/systems/ProjectileSystem.js` to apply wind displacement:
```javascript
<<<<
        const progress = t / proj.arrivalTick;

        if (t < proj.arrivalTick) {
            // Use explicit intended vector to avoid "Shortest Path" directional flips
            proj.currX = TorusMath.wrapX(
                proj.startX + proj.intendedDx * progress,
                gameState.map.width
            );
            proj.currY = TorusMath.wrapY(
                proj.startY + proj.intendedDy * progress,
                gameState.map.height
            );
        } else if (t === proj.arrivalTick) {
            // Final arrival precisely at arrivalTick
            proj.currX = TorusMath.wrapX(proj.startX + proj.intendedDx, gameState.map.width);
            proj.currY = TorusMath.wrapY(proj.startY + proj.intendedDy, gameState.map.height);
            proj.active = false;
====
        const progress = t / proj.arrivalTick;

        let windX = 0;
        let windY = 0;
        if (gameState.windState?.active) {
            windX = gameState.windState.dx * t;
            windY = gameState.windState.dy * t;
        }

        if (t < proj.arrivalTick) {
            // Use explicit intended vector to avoid "Shortest Path" directional flips
            proj.currX = TorusMath.wrapX(
                proj.startX + proj.intendedDx * progress + windX,
                gameState.map.width
            );
            proj.currY = TorusMath.wrapY(
                proj.startY + proj.intendedDy * progress + windY,
                gameState.map.height
            );
        } else if (t === proj.arrivalTick) {
            // Final arrival precisely at arrivalTick
            const finalWindX = gameState.windState?.active ? gameState.windState.dx * proj.arrivalTick : 0;
            const finalWindY = gameState.windState?.active ? gameState.windState.dy * proj.arrivalTick : 0;
            proj.currX = TorusMath.wrapX(proj.startX + proj.intendedDx + finalWindX, gameState.map.width);
            proj.currY = TorusMath.wrapY(proj.startY + proj.intendedDy + finalWindY, gameState.map.height);
            proj.active = false;
>>>>
```
2. Modify `updateSeekerProjectile` in `shared/systems/ProjectileSystem.js` to add continuous wind speed step updates:
```javascript
<<<<
        // 4. Step-based Movement
        const moveDist = proj.velocity;
        const rad = (proj.currentAngle || 0) * (Math.PI / 180);
        proj.currX = TorusMath.wrapX(proj.currX + Math.cos(rad) * moveDist, gameState.map.width);
        proj.currY = TorusMath.wrapY(proj.currY + Math.sin(rad) * moveDist, gameState.map.height);
        proj.totalDistanceMoved += moveDist;
====
        // 4. Step-based Movement
        const moveDist = proj.velocity;
        const rad = (proj.currentAngle || 0) * (Math.PI / 180);
        const windX = gameState.windState?.active ? gameState.windState.dx : 0;
        const windY = gameState.windState?.active ? gameState.windState.dy : 0;

        proj.currX = TorusMath.wrapX(proj.currX + Math.cos(rad) * moveDist + windX, gameState.map.width);
        proj.currY = TorusMath.wrapY(proj.currY + Math.sin(rad) * moveDist + windY, gameState.map.height);
        proj.totalDistanceMoved += moveDist;
>>>>
```

**Step 4: Run test to verify it passes**
Run: `npx vitest run shared/tests/WindPhysics.test.js`
Expected: PASS

**Step 5: Commit**
```bash
git add shared/systems/ProjectileSystem.js shared/tests/WindPhysics.test.js
git commit -m "feat(weather): apply continuous wind drift in projectile movement"
```

---

### Task 3: Client HUD Wind Indicator Component & Integration

**Files:**
* Modify: `client/src/components/HUD/SidebarLeft.jsx`
* Modify: `client/src/App.css`

**Step 1: Implement JSX updates in SidebarLeft**
Modify `client/src/components/HUD/SidebarLeft.jsx` to render the wind panel below the player stats block and above the Audio panel:

```jsx
<<<<
            </div>

            <div className="audio-panel">
====
            </div>

            {playerState?.windState && playerState.map?.modifiers?.windEnabled && (
                <div className="wind-panel">
                    <div className="panel-title">ATMOSPHERE STATUS</div>
                    <div className="wind-status">
                        {playerState.windState.active ? (
                            <div className="wind-active-details">
                                <div className="wind-warning animate-flash">HIGH WIND WARNING</div>
                                <div className="wind-vector">
                                    <span>SPEED: {(playerState.windState.speed * 10).toFixed(1)} m/s</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        BEARING: {Math.round(playerState.windState.angle)}°
                                        <span 
                                            className="wind-compass-arrow" 
                                            style={{ 
                                                display: 'inline-block', 
                                                transform: `rotate(${playerState.windState.angle}deg)`,
                                                fontSize: '0.9rem',
                                                lineHeight: '1',
                                                transition: 'transform 0.5s ease'
                                            }}
                                        >
                                            ↑
                                        </span>
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="wind-calm">ATMOSPHERIC PRESSURE: STABLE (NO WIND)</div>
                        )}
                    </div>
                </div>
            )}

            <div className="audio-panel">
>>>>
```

**Step 2: Add styles to App.css**
Modify `client/src/App.css` to style the wind indicators and animate warning flashes:

```css
/* Retro-Tactical Wind Panel */
.wind-panel {
    margin-top: 1rem;
    padding-top: 0.8rem;
    border-top: 2px solid #222;
    text-align: left;
}

.wind-panel .panel-title {
    font-size: 0.6rem;
    text-transform: uppercase;
    color: #666;
    letter-spacing: 1px;
    margin-bottom: 0.4rem;
}

.wind-status {
    background: #080808;
    border: 1px solid #1a1a1a;
    padding: 0.6rem;
    font-size: 0.7rem;
    font-family: 'Courier New', Courier, monospace;
    border-radius: 2px;
}

.wind-warning {
    color: #ff3366;
    font-weight: bold;
    display: block;
    margin-bottom: 0.4rem;
    text-shadow: 0 0 5px rgba(255, 51, 102, 0.4);
}

.wind-vector {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: #00ff6c;
}

.wind-calm {
    color: #666;
    font-style: italic;
}

/* Flashing Warning Keyframe */
@keyframes warningFlash {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
}

.animate-flash {
    animation: warningFlash 1.5s infinite ease-in-out;
}
```

**Step 3: Commit**
```bash
git add client/src/components/HUD/SidebarLeft.jsx client/src/App.css
git commit -m "feat(ui): add wind HUD indicator with directional compass arrow"
```

---

### Task 4: GameBoard Canvas Particles & Wind Streaks Rendering

**Files:**
* Modify: `client/src/components/GameBoard.jsx`

**Step 1: Write particle simulation updates**
Modify the canvas rendering loop inside `client/src/components/GameBoard.jsx`. 

1. Declare particle arrays inside the canvas hook `useEffect` block so particles persist:
```javascript
<<<<
            let animationFrameId;
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');

            const updateAndDraw = () => {
====
            let animationFrameId;
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');

            // Initialize wind particle array
            const windParticles = [];
            const PARTICLE_COUNT = 80;
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                windParticles.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    length: Math.random() * 40 + 20,
                    speedMultiplier: Math.random() * 1.5 + 0.5
                });
            }

            const updateAndDraw = () => {
>>>>
```

2. Inside `updateAndDraw`, at the very end (after restoring camera state and drawing standard elements, right before `requestAnimationFrame` trigger), draw the screen-space wind streaks if wind is active:
```javascript
<<<<
                            // 6. DRAW UI OVERLAY
                            drawUIOverlay(
                                ctx,
                                visualEntities.current,
                                committedActions,
                                maxPullDistance,
                                HUB_RADIUS
                            );

                            ctx.restore();
                        }
                    }
                    ctx.restore();
                } catch (err) {
                    console.error('Rendering Error:', err);
                }
                animationFrameId = requestAnimationFrame(updateAndDraw);
            };
====
                            // 6. DRAW UI OVERLAY
                            drawUIOverlay(
                                ctx,
                                visualEntities.current,
                                committedActions,
                                maxPullDistance,
                                HUB_RADIUS
                            );

                            ctx.restore();
                        }
                    }
                    ctx.restore();

                    // --- DRAW SCREEN-SPACE WIND PARTICLES ---
                    if (currentGameState.windState?.active && currentGameState.map?.modifiers?.windEnabled) {
                        const windAngle = currentGameState.windState.angle;
                        const windSpeed = currentGameState.windState.speed;
                        const windRad = (windAngle * Math.PI) / 180;
                        const dx = Math.cos(windRad);
                        const dy = Math.sin(windRad);

                        ctx.save();
                        ctx.strokeStyle = 'rgba(0, 243, 255, 0.12)';
                        ctx.lineWidth = 1;

                        windParticles.forEach((p) => {
                            // Update position based on wind velocity
                            p.x += dx * windSpeed * p.speedMultiplier * 3;
                            p.y += dy * windSpeed * p.speedMultiplier * 3;

                            // Wrap-around screen bounds
                            if (p.x < -100) p.x = canvas.width + 100;
                            else if (p.x > canvas.width + 100) p.x = -100;

                            if (p.y < -100) p.y = canvas.height + 100;
                            else if (p.y > canvas.height + 100) p.y = -100;

                            // Draw streak
                            ctx.beginPath();
                            ctx.moveTo(p.x, p.y);
                            ctx.lineTo(p.x + dx * p.length, p.y + dy * p.length);
                            ctx.stroke();
                        });

                        ctx.restore();
                    }

                } catch (err) {
                    console.error('Rendering Error:', err);
                }
                animationFrameId = requestAnimationFrame(updateAndDraw);
            };
>>>>
```

**Step 2: Commit**
```bash
git add client/src/components/GameBoard.jsx
git commit -m "feat(ui): render canvas screen-space wind particles"
```

---

### Task 5: Enable Wind Modifier on Default Map

**Files:**
* Modify: `server/MapService.js` (or map loader file)

**Step 1: Check map files**
Check `server/MapService.js` to see where maps are loaded/stored. Add `modifiers: { windEnabled: true }` to the default maps.

**Step 2: Commit**
```bash
git commit -am "feat(config): enable windEnabled modifier on default maps"
```
