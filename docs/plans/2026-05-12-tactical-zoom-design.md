# Design Document: Responsive Tactical Zoom

## Goal
Implement a responsive zoom system (mouse wheel and pinch-to-zoom) for the `GameBoard` that scales the map while keeping UI elements fixed and preventing toroidal tiling artifacts.

## Architecture
- **State Location:** `App.jsx` will manage the `zoom` state to ensure all components (GameBoard, RadialMenu positioning) stay in sync.
- **Scaling Method:** Canvas `ctx.scale(zoom, zoom)` will be used for rendering.
- **Coordinate Mapping:** `getGameCoords` and `getScreenCoords` in `GameBoard.jsx` will be updated to use the dynamic `zoom` prop.

## Constraints & Requirements
- **Minimum Zoom:** Dynamic. Calculated as `Math.max(viewportWidth / mapWidth, viewportHeight / mapHeight)`. This ensures the map always fills the viewport and prevents seeing "duplicate" tiled entities on large screens.
- **Maximum Zoom:** Hard-capped at `3.0x`.
- **Zoom Centering:** Zooming must be relative to the mouse cursor (desktop) or pinch midpoint (mobile). This requires adjusting the `cameraOffset` during the zoom event.

## Input Handling
- **Wheel Event:** Listen for `wheel` on the GameBoard container.
    - `deltaY` determines zoom direction.
    - Calculate world coordinates at cursor, apply zoom, then adjust `cameraOffset` to keep world coordinates at the same screen position.
- **Touch Events (Pinch):**
    - Track `touchmove` with 2 pointers.
    - Calculate distance change between pointers to determine zoom factor.
    - Midpoint between pointers serves as the zoom anchor.

## UI Integration
- **Sidebars:** Unaffected (fixed CSS layout).
- **Radial Menu:**
    - Its *position* is derived from `getScreenCoords`, which will now account for `zoom`.
    - Its *visual scale* remains 1:1 for readability.

## Verification Plan
- **Desktop:** Verify smooth scrolling with mouse wheel centered on different map regions.
- **Mobile (Simulated):** Use browser dev tools to verify pinch-to-zoom behavior.
- **Toroidal Check:** Zoom out to the minimum level on a 1440p screen and confirm no "duplicate" map tiles are visible.
