# Mobile-First Tactical Console Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Transform the game's layout into a landscape-optimized "Three-Pillar" Tactical Console.

**Architecture:** Use a CSS Grid-based layout in `App.css` to define Left (Stats), Center (Map), and Right (Actions) columns. Refactor `App.jsx` to move the legacy header content into these sidebars.

**Tech Stack:** React, CSS Grid, Socket.io, vault66-crt-effect.

---

### Task 1: CSS Grid Foundation
**Files:**
- Modify: [App.css](file:///home/behalr/titan-nexus-command/client/src/App.css)

**Step 1: Define the Three-Pillar Grid**
Replace the current `.App` and viewport styles with a grid that supports sidebars and a centered square map.

**Step 2: Commit**
```bash
git add client/src/App.css
git commit -m "layout: establish three-pillar css grid foundation"
```

### Task 2: Component Refactoring - Sidebars
**Files:**
- Modify: [App.jsx](file:///home/behalr/titan-nexus-command/client/src/App.jsx)

**Step 1: Extract Header Content to Sidebars**
Refactor the `{header}` JSX block in `App.jsx` into `<aside className="sidebar-left">` and `<aside className="sidebar-right">` within the main render loop.

**Step 2: Integrate Branding and Sync Status**
Move the logo/title to the left sidebar and the sync monitor/dots to the right sidebar.

**Step 3: Commit**
```bash
git add client/src/App.jsx
git commit -m "feat: refactor header into tactical sidebars"
```

### Task 3: Mobile Ergonomics & Visual Polish
**Files:**
- Modify: [App.css](file:///home/behalr/titan-nexus-command/client/src/App.css)
- Modify: [App.jsx](file:///home/behalr/titan-nexus-command/client/src/App.jsx)

**Step 1: Style the Sidebars**
**Step 1: Style the Sidebars**
Add "Industrial Console" styling: solid black backgrounds, player-accented borders, and vertical stacking for stats. Ensure buttons are large enough for thumb-taps.

**Step 2: Maintain CRT Isolation**
Ensure the `<CRTEffect>` component remains wrapping ONLY the `.game-world` / `GameBoard` container, preserving its isolation from the new sidebar elements.

**Step 3: Commit**
```bash
git add client/src/App.jsx client/src/App.css
git commit -m "ui: style console panels and extend crt effect"
```

### Task 4: Verification
**Files:**
- Test: Use Browser Agent

**Step 1: Visual Layout Verification**
Run the browser subagent in 390x844 (landscape) to verify:
1. Map is a centered square.
2. Left sidebar shows Energy/Turn.
3. Right sidebar shows Execute button.
4. CRT effect covers all three columns.

**Step 2: Final Commit**
```bash
git commit --allow-empty -m "verif: console layout verified in landscape mobile view"
```
