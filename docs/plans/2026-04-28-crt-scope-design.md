# Design: CRT Effect Scope Restriction

## Goal
Restrict the `CRTEffect` to the interactive game viewport while excluding the Header, Footer, and non-game views (Lobby, Designer). Ensure scanline consistency between the `GameBoard` and `RadialMenu`.

## Proposed Changes

### 1. Structural Refactor in `App.jsx`
- Remove the global `<CRTEffect>` wrapper from the root of the `App` component.
- Move `<CRTEffect>` into the `matchStarted` branch of `renderContent()`.
- Wrap the `<main className="game-world">` and `<div className="winner-overlay">` inside the same `<CRTEffect>` instance.
- Ensure the `<header>` and `<footer>` are outside the effect wrapper.

### 2. Layout & CSS Adjustments
- Introduce a viewport container in `App.jsx` to hold the CRT-wrapped game area.
- **`App.css`**:
    - Update `.crt-effect-wrapper` to use `position: absolute !important` and `inset: 0 !important`.
    - Ensure its parent container (`.viewport-crt-container`) has `position: relative`, `flex: 1`, and `overflow: hidden`.
    - This allows the CRT effect to "fill" its container instead of the whole screen.

### 3. Non-Game Views
- **Lobby:** The `LobbyOverlay` will be rendered directly, without any CRT wrapper.
- **Designer:** The `MapDesigner` will be rendered without CRT.
- **Loading:** The loading screen will lead with a clean "Header" and clean status info.

## Success Criteria
- [ ] Lobby, Header, and Footer have no CRT distortion or scanlines.
- [ ] Game Board and Radial Menu are overlaid with consistent, contiguous scanlines.
- [ ] Winner overlay (game-over screen) feels like it's "part of the monitor" (has CRT effect).
- [ ] No layout breakage when switching between views.

## Verification Plan
- **Manual Verification:** 
    - Enter the Lobby: Verify it's "clean".
    - Start a Match: Verify scanlines appear only in the center area.
    - Open Radial Menu: Verify scanlines align perfectly with the background game board.
    - Check Header/Footer/sidebar: Verify they remain perfectly sharp and "on top" of the monitor effect.
