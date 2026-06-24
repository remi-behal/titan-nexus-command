# Design Document: Mobile-First Tactical Console Layout

## Goal
Transform the desktop-first header/main layout into a mobile-friendly "Three-Pillar" Tactical Console optimized for Landscape orientation.

## Proposed Layout Architecture
- **Orientation:** Forced/Optimized for Landscape.
- **The Three-Pillar Grid:**
    - **Left Sidebar (Data):** 140px fixed width. Contains Logo, Energy, Income, Turn, and Timer.
    - **Center Viewport (Combat):** 1:1 Aspect Ratio square. Contains the `GameBoard`.
    - **Right Sidebar (Command):** 140px fixed width. Contains Sync Status, Execute Button, Clear Button, and Toggle switches.

## Components & UI Elements

### Left Sidebar (Tactical Data)
- **Identity:** Vertical "TITAN: NEXUS COMMAND" branding.
- **Stats HUD:** High-contrast blocks for Energy (+Income) and Turn.
- **Timer:** A visual countdown (bar or circle) for ergonomic time-tracking.

### Right Sidebar (Command Interface)
- **Sync Monitor:** P1/P2 dots integrated at the top.
- **Main Action:** A large, thumb-accessible "COMPLETE TURN" button at the bottom.
- **Controls:** Tactile toggles for "Landing Preview" and other debug features.

### Unified Visuals
- **CRT Isolation:** The `CRTEffect` will remain strictly isolated to the **Center Viewport (Map)**. This ensures the combat theater has the retro-tactical feel while the sidebars remain high-definition and crisp for maximum readability.
- **Theming:** Solid black panels with player-accented borders to reinforce the "Industrial Console" aesthetic.

## Responsiveness & Edge Cases
- **Ultra-Wide Screens:** The three-pillar console will be center-aligned with a `max-width`, preventing UI elements from stretching too far to the edges.
- **Mobile Viewport:** Sidebars will scale slightly or use compact icons if the device width is extremely narrow, but the primary target is a standard 16:9 to 21:9 landscape smartphone.

## Verification Plan
- **Browser Testing:** Verify that the "Execute" button is easily reachable by the right thumb in a simulated iPhone/Android landscape view.
- **Visual Check:** Confirm that CRT scanlines cover the sidebars and that the map remains a perfect square.
