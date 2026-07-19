# Design Document: Dual-Circle Explosion Design

This document details the redesign of the explosion graphic in Titan Nexus Command to use a clean, concentric dual-circle vector aesthetic.

## Objective
Remove all spark particles and replace the explosion graphic with:
1. A small solid core (white/bright tinted color) expanding to 20% of full radius.
2. A hollow outer ring (weapon/nuke color) expanding to 100% of full radius.

## Detail Specifications

### 1. Expansion Curves
* **Core Radius**: $R_{\text{core}} = R_{\text{max}} \times 0.2 \times p^{0.2}$ (fast pop)
* **Outer Ring Radius**: $R_{\text{outer}} = R_{\text{max}} \times p^{0.4}$
* **Fade**: $\alpha = 1 - p^2$

### 2. Styling
* **Core**: Solid circle filled with `#ffffff` (white) with matching glow.
* **Outer**: Stroked circle with theme color, tapering `lineWidth = 3 * (1 - p)`.
