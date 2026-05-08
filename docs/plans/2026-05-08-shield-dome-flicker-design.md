# Design: Shield Dome Low Health Flickering

## Overview
Currently, when a Shield entity has low barrier HP, the generator structure (the core) flickers. This design moves that visual feedback to the Shield Dome field itself, while keeping structure flickering reserved for the generator's actual health.

## User Review Required
> [!IMPORTANT]
> The flickering logic will be standardized in `drawField` to match `drawShape`, ensuring visual consistency across all "warning" states in the game.

## Proposed Changes

### ShapeRenderer.js
- Update `drawField` signature to accept `isWarning`.
- Implement high-frequency alpha oscillation when `isWarning` is true.

### GameBoard.jsx
- Separate warning detection for `SHIELD` entities.
- Pass `hp <= 1` to the generator's `drawShape`.
- Pass `barrierHp <= 1` to the dome's `drawField`.

## Verification Plan

### Manual Verification
- Deploy a Shield in-game.
- Reduce barrier HP to 1.
- **Expectation**: The blue dome circle flickers at high frequency. The central hexagonal core remains solid.
- Reduce generator HP to 1.
- **Expectation**: The central hexagonal core flickers.
