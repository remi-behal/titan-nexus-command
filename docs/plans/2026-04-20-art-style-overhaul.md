# Art Style Overhaul: Tactical Lo-Fi Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Transform the game into a "Tiberian Sun meets Beyond All Reason" aesthetic with gritty industrial elements and high tactical clarity, optimized for PC and mobile.

**Architecture:** Hybrid approach using CSS3 filters/overlays for atmosphere, low-res textured Canvas drawing for game objects, and industrial CSS styling for the HUD.

**Tech Stack:** React, HTML5 Canvas 2D, Vanilla CSS.

---

### Task 1: Atmospheric Foundation (Overlay & Map)

**Files:**
- Modify: `client/src/App.css`
- Modify: `client/src/components/GameBoard.jsx`

**Step 1: Add Global Scanline and CRT Overlay**
Create a `.viewport-overlay` in `App.jsx` and style it in `App.css` with a repeating linear gradient for scanlines and a subtle noise filter.

**Step 2: Update App.css for moody lighting**
```css
.game-world {
    filter: contrast(1.1) brightness(0.8) saturate(0.8) sepia(0.1);
}
```

**Step 3: Implement Tiled Lunar Background in GameBoard.jsx**
Replace the simple black background and #222 grid with a tiled, low-res "cratered surface" texture. We can draw this procedurally or use a small repeatable image.

**Step 4: Commit**
`git commit -m "style: add scanline overlay and moody atmospheric filters"`

---

### Task 2: Industrial HUD Overhaul

**Files:**
- Modify: `client/src/App.css`
- Modify: `client/src/App.jsx`

**Step 1: Restyle Header with Industrial Theme**
Update `.game-header` to use a dark, weathered metal background texture and a high-precision technical font (e.g., 'Courier New' or a Google Font like 'JetBrains Mono').

**Step 2: Update Status Badges**
Change `.badge`, `.energy`, and `.timer` to have beveled borders and "glow-on-dark" text.

**Step 3: Commit**
`git commit -m "style: overhaul HUD with industrial tactical theme"`

---

### Task 4: Gritty Building Sprites (Faux-Isometric)

**Files:**
- Modify: `client/src/components/GameBoard.jsx`
- Create: `client/public/assets/lowres_hub.png` (Draft using simple canvas drawing if no assets)

**Step 1: Replace Hex Hub with Isometric Sprite**
Update `GameBoard.jsx` entity rendering loop. Instead of `ctx.arc` for Hubs, draw a pre-calculated isometric building sprite.

**Step 2: Update Resource Nodes**
Change resource dots to look like "Crystals" or "Extraction Points" with better glowing animations.

**Step 3: Commit**
`git commit -m "style: implement isometric building sprites for Hubs"`

---

### Task 4: Industrial Links & Effects

**Files:**
- Modify: `client/src/components/GameBoard.jsx`

**Step 1: Restyle Power Cords**
Change `drawLinks` to render thick "Industrial Cables" with segmented textures and a pulsing electricity effect.

**Step 2: Dithered Projectile Trails**
Add a "pixel-art" style dithering effect to missile smoke trails using a custom pattern brush in Canvas.

**Step 3: Commit**
`git commit -m "style: implement industrial power cords and dithered trails"`

---

### Task 5: Verification & Mobile Check

**Step 1: Automated Verification**
Run: `npm run build`
Expected: Success. Check that asset size hasn't ballooned.

**Step 2: Manual Browser Verification**
1. Open the game in the browser.
2. Verify scanlines are visible but don't obscure text.
3. Verify Hubs look industrial and isometric.
4. Verify "Complete Turn" button and HUD remain highly legible (BAR influence).
