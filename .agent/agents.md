# Agent Instructions & Project Context

This document serves as the strategic briefing for any AI agent working on the **Titan: Nexus Command** project. 

## 1. Project Mission
Build a browser-based, simultaneous turn-based strategy game for 2-8 players set on the surface of Saturn's moon, Titan. The game centers on expanding territory from "Hubs" using a physics-based "Slingshot" launching mechanic. The ultimate goal is to eliminate all other players' Hubs.

## 2. Core Philosophy
- **Skill over Automation**: Aiming should feel weighty and deliberate. We prioritize "feel" (visual arrows, color-coded power) over pinpoint accuracy.
- **Headless Logic**: All game rules, state transitions, and math must reside in `GameState.js`. This file must remain agnostic of React, DOM, or Canvas. It will eventually live on a Node.js server.
- **Phased Growth**: We build in blocks. 1. Single Player -> 2. Networking -> 3. Room Management -> 4. Deployment.

## 4. Shell & Command Execution
- **Host OS**: Antigravity runs on a Windows 11 machine, but **all project code** is in WSL.
- **Terminal**: The integrated terminal is now fixed to default to **Ubuntu-24.04**. Connection to WSL was established by the user using the Command Palette "Remote-WSL: Connect to WSL". 

## 5. Monorepo Structure
- **Root**: Documentation and workspace management (`package.json`).
- **`client/`**: React + Vite toolchain.
- **`server/`**: Node.js API.
- **`shared/`**: Game logic (Single Source of Truth) used by both halves.
- **Command**: Use `npm run dev` from the root to start both client and server simultaneously.




