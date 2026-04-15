# Design Doc: Radial Menu for Hub Actions

**Date**: 2026-04-15
**Status**: Approved

## Problem Statement
The current multi-step process for launching structures (Select Hub -> Select Item from Dropdown -> Click Launch Button -> Drag) is cumbersome and not optimized for touch screens. 

## Proposed Solution
Introduce a categorized **Radial Menu** that opens directly on the selected hub, allowing for quick selection and immediate transition into launch mode.

## User Flow
1. **Selection**: Clicking/Tapping a Hub opens the Radial Menu.
2. **Phase 1 (Categories)**: User selects from 4 categories: **Offense**, **Defense**, **Utility**, or **Special**.
3. **Phase 2 (Items)**: Tapping a category replaces the ring with the structures in that category.
4. **Lock-In**: Tapping an item closes the menu and prepares the Hub for launch.
5. **Launch**: Dragging from the center of the Hub initiates the slingshot aiming.
6. **Cancel**: Tapping the center "X" or clicking elsewhere deselects the hub and closes the menu.

## Categorization
| Category | Entities |
|----------|----------|
| **Offense** | WEAPON, CLUSTER_BOMB, HOMING_MISSILE, NUKE, NAPALM |
| **Defense** | LASER_POINT_DEFENSE, LIGHT_SAM_DEFENSE, SMART_SAM_DEFENSE, FLAK_DEFENSE, SHIELD |
| **Utility** | EXTRACTOR, CLOAKING_FIELD, RECLAIMER |
| **Special** | OVERLOAD, EMP, ECHO_ARTILLERY, SUPER_BOMB |

## Technical Architecture
### Data
- Add `category: "OFFENSE" | "DEFENSE" | "UTILITY" | "SPECIAL"` to each entry in `ENTITY_STATS`.

### Components
- **`RadialMenu.jsx`**: 
    - Rendered in `App.jsx` as an absolute-positioned overlay.
    - Synchronizes with `GameBoard` coordinate mapping.
    - Uses SVG for the ring segments to ensure high fidelity and hit detection.
- **`GameBoard.jsx`**:
    - Draw a small ghosted icon of the selected item **North** of the hub when in "Ready" mode.
    - Handle coordinate occlusion to ensure clicks on the menu don't accidentally pan the map.

### Visual Style
- **Aesthetics**: Glassmorphism or sleek neon borders consistent with the "Titan: Nexus Command" theme.
- **Animations**: Subtle scale-up on entry, segment rotation on category swap.

## Verification Plan
- **Manual**: Test hub selection and categorized selection on desktop and simulated touch (dev tools).
- **Functionality**: Ensure selecting an item through the radial menu correctly updates `selectedItemType` and toggles `launchMode`.
- **Edge Cases**: Verify menu follows hub during panning. Verify menu closes on deselect.
