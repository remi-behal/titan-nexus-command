# Design Doc: Art Style Overhaul (Tiberian Sun x Beyond All Reason)

## Goal
Improve the game's visual style from "basic" to a "Tactical Lo-Fi" aesthetic inspired by *Command & Conquer: Tiberian Sun* (gritty industrial) and *Beyond All Reason* (tactical clarity). The design prioritizes low resource usage for PC and Mobile.

## Core Aesthetic: "Industrial Minimalist"
- **Perspective**: Top-down logic with "Faux-Isometric" unit/building sprites.
- **Atmosphere**: Moody, dark, gritty metal textures, glowing neon accents, and scanline overlays.
- **Clarity**: High-contrast tactical UI elements (health bars, icons, paths).

## Proposed Changes

### 1. Rendering Layer (Post-Processing)
- **Overlay**: A global CSS overlay (scanlines, noise, color grading) to unify the canvas and UI.
- **Texturing**: Low-resolution "gritty" patterns for the map background (cratered moon surface) and building fills.

### 2. Game Objects (Units & Buildings)
- **Hubs & Structures**: Replace hexagonal shapes with top-down isometric sprites (weathered metal, glowing orange windows).
- **Cords**: Industrial "power cable" style links between buildings with a subtle glowing pulse.
- **Projectiles**: Glowing missiles with smoke/dithered trails; interception impacts with pixel-art explosions.

### 3. UI Layer (HUD & Menus)
- **Header Bar**: Dark industrial frame showing Energy, Turn, and Time with a technical font.
- **Radial Menu**: Segmented dark segments with industrial icons.
- **Tactical Icons**: Clear, bright neon icons for fast recognition (similar to BAR).

## Technical Implementation (Option 3: Tactical Lo-Fi)
- **Sprites**: Single-direction isometric sprites for 1 faction.
- **Resolution**: Targeted at low-res ("retro") to minimize bundle size.
- **Performance**: Standard 2D Canvas API for the game board; CSS3 for UI overlays.

## Success Criteria
- [ ] Visual style is significantly improved and feels "premium" and gritty.
- [ ] Game remains performant on mobile devices.
- [ ] Tactical clarity (which unit is which, status of links) is maintained or improved.
