# Design Document: Dynamic Explosion Graphic Redesign

This document outlines the design and plan for upgrading the basic explosion graphic in Titan Nexus Command to a dynamic, multi-layered, vector-themed effect.

## Objective
Replace the static jagged shape currently used for explosions with a dynamic, retro-themed vector animation featuring concentric shockwaves and radiating spark particles. The animation will be high-performance, smooth (60fps), and synchronize with the game's duration.

## Architecture & Logic

### 1. Lifetime Tracking on Client
In `useVisualInterpolation.js`, when a visual entity is first created, we will store `spawnTime: Date.now()`.
This allows the client renderer to calculate a precise interpolation progress factor:
$$p = \frac{\text{Date.now()} - \text{spawnTime}}{\text{duration} \times 60}$$

### 2. Procedural Animation Curves
* **Rapid Initial Expansion**:
  * Shockwave progress: $p_{\text{fast}} = p^{0.3}$
  * Particle drag distance: $D(p) = R_{\text{max}} \times (1.2 \times (1 - e^{-5p}))$
* **Decay & Fade**:
  * Opacity progress: $\alpha = 1 - p^{1.5}$
  * Line width decay: $\text{lineWidth} = \text{baseWidth} \times (1 - p)$

### 3. Visual Layers
1. **Primary Shockwave Ring**: Circles expanding dynamically to $R_{\text{max}}$ with fading alpha and stroke width.
2. **Secondary Delayed Ring**: Adds visual depth by starting expansion at a slight delay.
3. **Seeded Spark Particles**:
   * Deterministic generation using a seeded pseudo-random helper function with `entity.id` as the seed.
   * Renders 12-16 radiating line segments directed outwards.

## Verification Plan
* Verify rendering correctness in Sandbox mode or using game actions.
* Ensure code compiles and lints correctly.
