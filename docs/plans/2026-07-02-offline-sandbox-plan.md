# Offline Practice Range Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Create an offline Practice Range (Sandbox Mode) accessible only from the lobby, allowing players to plan actions for both Player 1 and Player 2 with 9,999 energy, and simulate turn resolution locally.

**Architecture:** We will import `GameState` and `playgroundMap` on the client. `App.jsx` will support a new view `"SANDBOX"` which runs the simulation engine locally and streams turn snapshots to the canvas with custom timeouts, bypassing the socket connection.

**Tech Stack:** React, HTML5 Canvas, GameState simulation engine, Vitest.

---

### Task 1: Add Practice Range Option in Lobby Overlay

**Files:**
- Modify: `client/src/components/LobbyOverlay.jsx`

**Step 1: Run client integration tests to verify baseline status**
Run: `npx vitest run client/src/chat_app_integration.test.jsx`
Expected: PASS.

**Step 2: Add the button to LobbyOverlay.jsx**
Open [LobbyOverlay.jsx](file:///home/behalr/titan-nexus-command/client/src/components/LobbyOverlay.jsx) and add the `onOpenSandbox` prop and the Practice Range button inside the lobby setup panel, rendering it only if the match hasn't started.

```diff
 export const LobbyOverlay = ({
     lobbyUpdate,
     availableMaps,
     onClaimSeat,
     onReadyToggle,
     onSetMap,
     onOpenDesigner,
+    onOpenSandbox,
     socketId,
     socket
 }) => {
```

Add the button next to the Map Designer button:
```diff
 <button className="designer-btn" onClick={onOpenDesigner}>
     MAP DESIGNER
 </button>
+<button className="sandbox-btn" onClick={onOpenSandbox}>
+    PRACTICE RANGE
+</button>
```

**Step 3: Run integration test to verify it compiles and runs**
Run: `npx vitest run client/src/chat_app_integration.test.jsx`
Expected: PASS.

**Step 4: Commit**
```bash
git add -f client/src/components/LobbyOverlay.jsx
git commit -m "feat(lobby): add practice range button to lobby overlay"
```

---

### Task 2: Implement Sandbox Logic and State in App.jsx

**Files:**
- Modify: `client/src/App.jsx`
- Modify: `client/src/App.css`
- Create: `client/src/sandbox.test.jsx`

**Step 1: Write the failing test**
Create `client/src/sandbox.test.jsx` to verify that selecting the Practice Range renders the GameBoard with the sandbox state.

```javascript
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App.jsx';

describe('App Practice Range Sandbox Integration', () => {
    it('enters practice range and displays the sandbox interface', () => {
        render(<App />);
        const sandboxBtn = screen.getByText('PRACTICE RANGE');
        expect(sandboxBtn).toBeDefined();
        
        fireEvent.click(sandboxBtn);
        expect(screen.getByText(/PRACTICE RANGE \| ACTIVE PILOT/i)).toBeDefined();
    });
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run client/src/sandbox.test.jsx`
Expected: FAIL since the button callback and view are not implemented in `App.jsx` yet.

**Step 3: Write minimal implementation**

1. Open [App.jsx](file:///home/behalr/titan-nexus-command/client/src/App.jsx):
   - Import the playground map:
     ```javascript
     import playgroundMap from '../../shared/ready_maps/playground.json';
     ```
   - Add state and ref definitions inside `App()`:
     ```javascript
     const [sandboxState, setSandboxState] = useState(null);
     const [activeSandboxPlayer, setActiveSandboxPlayer] = useState('player1');
     const [sandboxActions, setSandboxActions] = useState([]);
     const localGameRef = useRef(null);
     const [isSandboxResolving, setIsSandboxResolving] = useState(false);
     ```
   - Implement the sandbox initiation method:
     ```javascript
     const handleOpenSandbox = () => {
         const g = new GameState();
         g.initializeGame(['player1', 'player2'], playgroundMap);
         g.players.player1.energy = 9999;
         g.players.player2.energy = 9999;
         localGameRef.current = g;
         setSandboxState(g.getState());
         setSandboxActions([]);
         setActiveSandboxPlayer('player1');
         setCurrentView('SANDBOX');
     };
     ```
   - Pass `onOpenSandbox={handleOpenSandbox}` to the `<LobbyOverlay />` component.
   - Implement the local simulation execution method:
     ```javascript
     const handleExecuteSandboxTurn = async () => {
         if (!localGameRef.current || isSandboxResolving) return;
         setIsSandboxResolving(true);

         const p1Actions = sandboxActions.filter((a) => a.playerId === 'player1');
         const p2Actions = sandboxActions.filter((a) => a.playerId === 'player2');

         const snapshots = localGameRef.current.resolveTurn({
             player1: p1Actions,
             player2: p2Actions
         });

         for (const snap of snapshots) {
             setSandboxState(snap.state);
             const delay = snap.type === 'ROUND_SUB' ? 60 : 1500;
             await new Promise((resolve) => setTimeout(resolve, delay));
         }

         setSandboxActions([]);
         localGameRef.current.players.player1.energy = 9999;
         localGameRef.current.players.player2.energy = 9999;
         setSandboxState(localGameRef.current.getState());
         setIsSandboxResolving(false);
     };
     ```
   - Update `renderContent()` in [App.jsx](file:///home/behalr/titan-nexus-command/client/src/App.jsx) to support the `'SANDBOX'` view:
     ```javascript
     if (currentView === 'SANDBOX') {
         const pCurrentSandbox = {
             ...sandboxState.players[activeSandboxPlayer],
             energy: 9999 - sandboxActions.filter(a => a.playerId === activeSandboxPlayer).reduce((sum, act) => {
                 const stats = ENTITY_STATS[act.itemType];
                 return sum + (stats?.cost || 0);
             }, 0)
         };

         const sidebarLeftSandbox = (
             <SidebarLeft
                 myPlayerId={activeSandboxPlayer}
                 pCurrent={pCurrentSandbox}
                 playerState={sandboxState}
                 isSpectator={false}
                 selectedHubId={selectedHubId}
             />
         );

         const sidebarRightSandbox = (
             <SidebarRight
                 syncStatus={{ lockedIn: { player1: false, player2: false } }}
                 playerState={sandboxState}
                 timeRemaining={null}
                 showDebugPreview={showDebugPreview}
                 cameraOffset={cameraOffset}
                 zoom={zoom}
                 committedActions={sandboxActions.filter(a => a.playerId === activeSandboxPlayer)}
                 interactionBlocked={isSandboxResolving}
                 handleClearActions={() => {
                     audioManager.playActionReset();
                     setSandboxActions(prev => prev.filter(a => a.playerId !== activeSandboxPlayer));
                 }}
                 handleExecuteTurn={handleExecuteSandboxTurn}
                 isLocked={false}
                 isResolvingUI={isSandboxResolving}
                 isSpectator={false}
                 isUnassigned={false}
             />
         );

         return (
             <>
                 {sidebarLeftSandbox}

                 <div className="viewport-crt-container" ref={viewportRef}>
                     <div className="sandbox-header" style={{ padding: '8px', background: '#111', borderBottom: '1px solid #333', display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: '0.8rem', zIndex: 10 }}>
                         <span>PRACTICE RANGE | ACTIVE PILOT:</span>
                         <button
                             style={{
                                 background: activeSandboxPlayer === 'player1' ? 'var(--player-accent-color, #00ff44)' : '#222',
                                 color: activeSandboxPlayer === 'player1' ? '#000' : '#888',
                                 border: '1px solid #444',
                                 padding: '2px 8px',
                                 cursor: 'pointer',
                                 fontSize: '0.75rem',
                                 fontWeight: 'bold'
                             }}
                             onClick={() => setActiveSandboxPlayer('player1')}
                         >
                             PLAYER 1 (BLUE)
                         </button>
                         <button
                             style={{
                                 background: activeSandboxPlayer === 'player2' ? 'var(--player-accent-color, #00ff44)' : '#222',
                                 color: activeSandboxPlayer === 'player2' ? '#000' : '#888',
                                 border: '1px solid #444',
                                 padding: '2px 8px',
                                 cursor: 'pointer',
                                 fontSize: '0.75rem',
                                 fontWeight: 'bold'
                             }}
                             onClick={() => setActiveSandboxPlayer('player2')}
                         >
                             PLAYER 2 (YELLOW)
                         </button>
                         <button
                             style={{
                                 background: '#552222',
                                 color: '#fff',
                                 border: '1px solid #883333',
                                 marginLeft: 'auto',
                                 padding: '2px 8px',
                                 cursor: 'pointer',
                                 fontSize: '0.75rem',
                                 fontWeight: 'bold'
                             }}
                             onClick={() => setCurrentView('LOBBY')}
                         >
                             EXIT RANGE
                         </button>
                     </div>
                     <div className="crt-scanlines-pixel-perfect" />
                     <main className={`game-world ${isSandboxResolving ? 'locked-out' : ''}`}>
                         <GameBoard
                             ref={gameBoardRef}
                             gameState={sandboxState}
                             myPlayerId={activeSandboxPlayer}
                             selectedHubId={selectedHubId}
                             selectedItemType={selectedItemType}
                             launchMode={launchMode}
                             isAiming={isAiming}
                             committedActions={sandboxActions.filter(a => a.playerId === activeSandboxPlayer)}
                             showDebugPreview={showDebugPreview}
                             maxPullDistance={MAX_PULL_DISTANCE}
                             isResolving={isSandboxResolving}
                             cameraOffset={cameraOffset}
                             setCameraOffset={setCameraOffset}
                             zoom={zoom}
                             setZoom={setZoom}
                             minZoom={minZoom}
                             onSelectHub={(id) => setSelectedHubId(id)}
                             onAimStart={handleAimStart}
                             onAimUpdate={() => {}}
                             onAimEnd={(x, y) => {
                                 // Override handleAimEnd logic locally for sandbox actions appending
                                 if (!isAiming) return;
                                 setIsAiming(false);
                                 const hub = sandboxState.entities.find((e) => e.id === selectedHubId);
                                 if (!hub) return;

                                 const { dx, dy } = GameState.getToroidalVector(
                                     hub.x,
                                     hub.y,
                                     x,
                                     y,
                                     sandboxState.map.width,
                                     sandboxState.map.height
                                 );
                                 let distance = Math.sqrt(dx * dx + dy * dy);
                                 if (distance > MAX_PULL_DISTANCE) distance = MAX_PULL_DISTANCE;
                                 const angle = GameState.calculateLaunchAngle(dx, dy);

                                 const launchDistance = GameState.calculateLaunchDistance(distance);
                                 const rad = (angle * Math.PI) / 180;
                                 const targetX = (hub.x + Math.cos(rad) * launchDistance + sandboxState.map.width) % sandboxState.map.width;
                                 const targetY = (hub.y + Math.sin(rad) * launchDistance + sandboxState.map.height) % sandboxState.map.height;

                                 const isInvalid = GameState.checkLinkAngleSeparation(
                                     selectedItemType,
                                     selectedHubId,
                                     targetX,
                                     targetY,
                                     sandboxState.links,
                                     sandboxActions,
                                     sandboxState.entities,
                                     sandboxState.map
                                 );

                                 if (isInvalid) {
                                     audioManager.playActionReset();
                                     setGlitchActive(true);
                                     setTimeout(() => setGlitchActive(false), 400);
                                     setLaunchMode(false);
                                     setSelectedHubId(null);
                                     return;
                                 }

                                 const action = {
                                     playerId: activeSandboxPlayer,
                                     type: 'LAUNCH',
                                     itemType: selectedItemType,
                                     sourceId: hub.id,
                                     sourceX: hub.x,
                                     sourceY: hub.y,
                                     angle: angle,
                                     distance: distance
                                 };

                                 if (selectedItemType === 'LINK') {
                                     audioManager.playLinkStage();
                                 } else {
                                     audioManager.playClick();
                                 }

                                 setSandboxActions((prev) => [...prev, action]);
                                 setLaunchMode(false);
                                 setSelectedHubId(null);
                             }}
                         />
                         {selectedHubId &&
                             !launchMode &&
                             !isSandboxResolving &&
                             (() => {
                                 const hub = sandboxState.entities.find((e) => e.id === selectedHubId);
                                 if (!hub) return null;
                                 return (
                                     <RadialMenu
                                         x={hubScreenPos?.x || 0}
                                         y={hubScreenPos?.y || 0}
                                         playerEnergy={9999}
                                         hubFuel={
                                             hub.fuel !== undefined
                                                 ? hub.fuel - sandboxActions.filter(a => a.sourceId === selectedHubId).length
                                                 : 99
                                         }
                                         onSelect={(type) => {
                                             setSelectedItemType(type);
                                             setLaunchMode(true);
                                         }}
                                         onCancel={() => setSelectedHubId(null)}
                                     />
                                 );
                             })()}
                     </main>
                 </div>

                 {sidebarRightSandbox}
             </>
         );
     }
     ```

2. Add styling variables or overrides in [App.css](file:///home/behalr/titan-nexus-command/client/src/App.css) for `.sandbox-header` if needed.

**Step 4: Run test to verify it passes**
Run: `npx vitest run client/src/sandbox.test.jsx`
Expected: PASS.

**Step 5: Commit**
```bash
git add -f client/src/App.jsx client/src/App.css client/src/sandbox.test.jsx
git commit -m "feat(sandbox): implement offline practice range view and simulation engine"
```
