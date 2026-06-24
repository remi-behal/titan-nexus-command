# Lobby Retro Terminal Deck Style Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Apply the premium retro-futuristic, glassmorphic terminal deck styling of `debug-audio.html` to the game lobby overlays, complete with Outfit & Share Tech Mono typography, CRT scanlines, and custom red/yellow player slot button accents.

**Architecture:** Utilize React semantic CSS classes (`slot-p1` and `slot-p2`) inside the lobby component to dynamically apply CSS custom variables (`--slot-accent`, `--slot-glow`) based on player positions, creating responsive and elegant interactive states without code duplication or logic breakage.

**Tech Stack:** React (JSX), Vanilla CSS (flexbox, CSS variables, linear/radial gradients, backdrop-filters, custom Google Fonts).

---

### Task 1: Update JSX Semantics in LobbyOverlay

**Files:**
- Modify: `client/src/components/LobbyOverlay.jsx`

**Step 1: Write JSX modifications**
Update `client/src/components/LobbyOverlay.jsx` around lines 17-33 to append custom CSS class names to the player slot buttons:
- Add `slot-p${index + 1}` to dynamically set `slot-p1` and `slot-p2`.
- Add `is-ready` if the slot is occupied and has `slot.ready === true`.

```jsx
<<<<
                <div className="slots-container">
                    {lobbyUpdate.slots.map((slot, index) => (
                        <button
                            key={index}
                            className={`slot-button ${slot ? 'occupied' : ''} ${mySeatIndex === index ? 'my-seat' : ''}`}
                            onClick={() => !slot && onClaimSeat(index)}
                            disabled={!!slot && slot.socketId !== socketId}
                        >
====
                <div className="slots-container">
                    {lobbyUpdate.slots.map((slot, index) => (
                        <button
                            key={index}
                            className={`slot-button slot-p${index + 1} ${slot ? 'occupied' : ''} ${mySeatIndex === index ? 'my-seat' : ''} ${slot?.ready ? 'is-ready' : ''}`}
                            onClick={() => !slot && onClaimSeat(index)}
                            disabled={!!slot && slot.socketId !== socketId}
                        >
>>>>
```

**Step 2: Commit**

```bash
git add client/src/components/LobbyOverlay.jsx
git commit -m "feat(lobby): add slot-p1/slot-p2 dynamic class names to player slots"
```

---

### Task 2: Implement Cyberpunk Glassmorphism & Custom Player Colors in Lobby CSS

**Files:**
- Modify: `client/src/components/LobbyOverlay.css`

**Step 1: Write CSS modifications**
Overwrite `client/src/components/LobbyOverlay.css` completely with the custom-designed retro-futuristic terminal deck style:
- Import Google Fonts `'Outfit'` and `'Share Tech Mono'`.
- Add the radial glowing dark background and CRT scanline overlay.
- Define theme variables on `.slot-p1` (Red: `#ff007f`) and `.slot-p2` (Yellow: `#ffd700`).
- Style slots and interactive buttons to match the SFX grid/action buttons from `debug-audio.html` with glowing hover states.

```css
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;700&family=Share+Tech+Mono&display=swap');

.lobby-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: #03030c;
    background-image: 
        radial-gradient(at 0% 0%, rgba(255, 0, 127, 0.08) 0, transparent 50%),
        radial-gradient(at 50% 0%, rgba(0, 243, 255, 0.08) 0, transparent 50%),
        radial-gradient(at 100% 0%, rgba(57, 255, 20, 0.05) 0, transparent 50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    color: #e2e8f0;
    font-family: 'Outfit', sans-serif;
    overflow: hidden;
}

/* CRT Scanline Overlay */
.lobby-overlay::before {
    content: " ";
    display: block;
    position: absolute;
    top: 0; left: 0; bottom: 0; right: 0;
    background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
    z-index: 9999;
    background-size: 100% 4px, 6px 100%;
    pointer-events: none;
}

.lobby-content {
    background: rgba(6, 6, 20, 0.85);
    border: 1px solid rgba(0, 243, 255, 0.2);
    border-top: 2px solid #00f3ff;
    padding: 3rem;
    border-radius: 16px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), inset 0 0 20px rgba(0, 243, 255, 0.05);
    text-align: center;
    width: 440px;
    backdrop-filter: blur(16px);
    position: relative;
}

.lobby-title {
    font-family: 'Share Tech Mono', monospace;
    font-size: 2.5rem;
    margin-top: 0;
    margin-bottom: 0.5rem;
    letter-spacing: 4px;
    color: #00f3ff;
    text-shadow: 0 0 10px rgba(0, 243, 255, 0.5);
}

.lobby-content p {
    color: #64748b;
    font-size: 0.95rem;
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-bottom: 2rem;
}

.slots-container {
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
    margin-bottom: 2rem;
}

/* Custom Variables per Player Position */
.slot-button.slot-p1 {
    --slot-accent: #ff007f;
    --slot-glow: rgba(255, 0, 127, 0.4);
    --slot-glow-light: rgba(255, 0, 127, 0.15);
}

.slot-button.slot-p2 {
    --slot-accent: #ffd700;
    --slot-glow: rgba(255, 215, 0, 0.4);
    --slot-glow-light: rgba(255, 215, 0, 0.15);
}

.slot-button {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 1.2rem;
    color: #cbd5e1;
    font-family: 'Share Tech Mono', monospace;
    font-size: 1.05rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
    overflow: hidden;
}

.slot-button:hover:not(:disabled) {
    background: rgba(0, 243, 255, 0.04);
    border-color: var(--slot-accent);
    color: #fff;
    transform: translateY(-2px);
    box-shadow: 0 4px 20px var(--slot-glow-light);
}

.slot-button:active:not(:disabled) {
    transform: translateY(0);
}

.slot-button.occupied {
    background: rgba(0, 0, 0, 0.2);
    cursor: not-allowed;
    opacity: 0.85;
}

.slot-button.my-seat {
    border-color: var(--slot-accent);
    box-shadow: 0 0 15px var(--slot-glow);
}

.status-badge {
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.8rem;
    padding: 0.3rem 0.8rem;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.05);
    color: #64748b;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.2s ease;
}

.slot-button:hover:not(:disabled) .status-badge {
    color: var(--slot-accent);
    border-color: var(--slot-accent);
}

.slot-button.my-seat .status-badge {
    color: var(--slot-accent);
    border-color: var(--slot-accent);
}

.status-badge.ready {
    background: rgba(57, 255, 20, 0.1);
    color: #39ff14;
    border-color: rgba(57, 255, 20, 0.3);
    text-shadow: 0 0 5px rgba(57, 255, 20, 0.5);
}

.map-selection {
    margin: 1.5rem 0;
    padding: 1.2rem;
    background: rgba(0, 0, 0, 0.2);
    border: 1px dashed rgba(0, 243, 255, 0.15);
    border-radius: 8px;
    text-align: left;
}

.map-selection label {
    display: block;
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 0.6rem;
    color: #64748b;
}

.map-select {
    width: 100%;
    padding: 0.8rem;
    background: rgba(0, 0, 0, 0.7);
    color: #39ff14;
    border: 1px solid rgba(0, 243, 255, 0.2);
    border-radius: 6px;
    font-family: 'Share Tech Mono', monospace;
    font-size: 1rem;
    cursor: pointer;
    outline: none;
    transition: all 0.2s ease;
}

.map-select:hover:not(:disabled) {
    border-color: #00f3ff;
    box-shadow: 0 0 10px rgba(0, 243, 255, 0.15);
}

.map-select:disabled {
    cursor: not-allowed;
    opacity: 0.85;
    background: rgba(0, 0, 0, 0.4);
    color: #64748b;
}

.host-only-hint {
    font-size: 0.75rem;
    color: #ff007f;
    margin-top: 0.5rem;
    font-style: italic;
    font-family: 'Outfit', sans-serif;
}

.ready-button {
    width: 100%;
    padding: 1.2rem;
    border-radius: 8px;
    border: 1px solid #39ff14;
    background: transparent;
    color: #39ff14;
    font-family: 'Share Tech Mono', monospace;
    font-weight: bold;
    font-size: 1.2rem;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-top: 1rem;
    text-transform: uppercase;
    box-shadow: inset 0 0 10px rgba(57, 255, 20, 0.05);
}

.ready-button:hover {
    background: #39ff14;
    color: #000;
    box-shadow: 0 0 15px rgba(57, 255, 20, 0.5);
}

.ready-button.is-ready {
    border-color: #ff007f;
    color: #ff007f;
    box-shadow: inset 0 0 10px rgba(255, 0, 127, 0.05);
}

.ready-button.is-ready:hover {
    background: #ff007f;
    color: #fff;
    box-shadow: 0 0 15px rgba(255, 0, 127, 0.5);
}

.designer-button {
    margin-top: 1rem;
    padding: 0.8rem 1.5rem;
    background: transparent;
    color: #00f3ff;
    border: 1px solid #00f3ff;
    border-radius: 8px;
    cursor: pointer;
    font-family: 'Share Tech Mono', monospace;
    font-weight: bold;
    font-size: 1rem;
    width: 100%;
    transition: all 0.2s ease;
    text-transform: uppercase;
}

.designer-button:hover {
    background: #00f3ff;
    color: #000;
    box-shadow: 0 0 15px rgba(0, 243, 255, 0.5);
}
```

**Step 2: Commit**

```bash
git add client/src/components/LobbyOverlay.css
git commit -m "style(lobby): apply sci-fi terminal deck glassmorphism and player-coded styles"
```

---

### Task 3: Visual Verification of Lobby UI Style

**Files:**
- Verification: Visual verification of http://localhost:5173

**Step 1: Open browser page to verify**
Ensure standard Vite dev server is running and open `http://localhost:5173` using the **browser-agent** subagent or directly.
- Inspect the custom glassmorphism, radial gradients, and CRT scanlines.
- Claim Seat 1 and verify it has Red outline accents (`slot-p1`).
- Claim Seat 2 (by testing with another player or checking CSS classes in dev tools) and verify it has Yellow outline accents (`slot-p2`).
- Verify dropdown selection, "Design Custom Map" hover states, and "I AM READY" glow effects.
