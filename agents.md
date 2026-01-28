# Agent Instructions & Project Context

This document serves as the strategic briefing for any AI agent working on the **Titan: Nexus Command** project. 

## 1. Project Mission
Build a browser-based, simultaneous turn-based strategy game for 2-8 players set on the surface of Saturn's moon, Titan. The game centers on expanding territory from "Hubs" using a physics-based "Slingshot" launching mechanic. The ultimate goal is to eliminate all other players' Hubs.

## 2. Core Philosophy
- **Skill over Automation**: Aiming should feel weighty and deliberate. We prioritize "feel" (visual arrows, color-coded power) over pinpoint accuracy.
- **Headless Logic**: All game rules, state transitions, and math must reside in `GameState.js`. This file must remain agnostic of React, DOM, or Canvas. It will eventually live on a Node.js server.
- **Phased Growth**: We build in blocks. 1. Single Player -> 2. Networking -> 3. Room Management -> 4. Deployment.

## 3. Technical Environment
- **WSL/Ubuntu**: The project is hosted in the Linux filesystem (`~/titan-nexus-command`). 
- **Stack**: React (Vite) + Socket.io + Node.js.
- **Rendering**: HTML5 Canvas managed via React `useRef` and `useEffect`. Don't use heavy libraries (Pixi/Phaser) unless requested.

## 4. Shell & Command Execution
- **Host OS**: Antigravity runs on a Windows 11 machine, but **all project code** is in WSL.
- **Terminal**: The integrated terminal is now fixed to default to **Ubuntu-24.04**. Connection to WSL was established by the user using the Command Palette "Remote-WSL: Connect to WSL". 

## 5. Interaction Model: The Slingshot
The game follows a strict state machine for actions:
1. **Selection**: User clicks a Hub they own.
2. **Item Pick**: User selects an item type (Hub, Weapon, etc.) from a menu.
3. **Launch Mode**: User clicks "Launch".
4. **The Sling**: Click + Drag *away* from the Hub.
   - **Visuals**: A dotted line to mouse, a color-coded "Power Arrow" in the opposite (launch) direction.
   - **Clamping**: Maximum pull distance is enforced (currently `MAX_PULL_DISTANCE = 300`).
5. **Commit**: Releasing the mouse locks the action. It appears "Greyed Out" on the map.
6. **Resolution**: Only after all players commit (or clock runs out) does the server process `resolveTurn()`.

## 6. Important Conventions
- **Coordinates**: The map is a large coordinate system (e.g., 2000x2000). Camera/Pan logic will be needed later.
- **Colors**: Hubs and Entities should be colored by their `owner`.
- **Debug Mode**: Always maintain the `showDebugPreview` toggle to help with testing pinpoint math vs. visual skill.

## 7. Current Context (Phase 2)
We are currently starting the **Local Multiplayer Setup** phase. We are in the process of initializing a Node.js server and installing Socket.io.

---
*Last Updated: January 2026*
