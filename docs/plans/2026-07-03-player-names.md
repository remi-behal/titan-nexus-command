# Player Custom Names Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Implement a player custom naming system during the lobby phase that persists to local storage, validates on the server, and propagates to the chat and gameplay HUD panels.

**Architecture:** We will extend the LobbyRoom slots to store custom names and perform uniqueness and formatting validations upon claimSeat socket emissions. The GameState initialization and index.js startup logic will be updated to forward custom player names into the active game state. Finally, the client's LobbyOverlay will display a retro modal to prompt for and persist the name in localStorage, and both HUD sidebars will dynamically render the custom names.

**Tech Stack:** React, Socket.io, Node.js, Vitest

---

### Task 1: LobbyRoom Seat Claiming Name Validation

**Files:**
- Modify: `server/LobbyRoom.js`
- Test: `server/lobby.test.js`

**Step 1: Write the failing test**

Add these tests to `/home/behalr/titan-nexus-command/server/lobby.test.js`:

```javascript
    it('should validate name length and uniqueness on claimSeat', () => {
        const room = new LobbyRoom('test-room', 4);
        
        // 1. Success claim
        const res1 = room.claimSeat(0, 'token-1', 'socket-1', 'Alpha');
        expect(res1.success).toBe(true);
        expect(room.slots[0].playerName).toBe('Alpha');

        // 2. Reject duplicate name (case-insensitive)
        const res2 = room.claimSeat(1, 'token-2', 'socket-2', 'alpha');
        expect(res2.success).toBe(false);
        expect(res2.message).toBe('Name is already taken!');

        // 3. Reject empty name or whitespace
        const res3 = room.claimSeat(1, 'token-2', 'socket-2', '   ');
        expect(res3.success).toBe(false);
        expect(res3.message).toBe('Name cannot be empty!');

        // 4. Reject over-long name
        const res4 = room.claimSeat(1, 'token-2', 'socket-2', 'VeryLongNameThatIsTooLong');
        expect(res4.success).toBe(false);
        expect(res4.message).toBe('Name must be 15 characters or less!');
    });
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run server/lobby.test.js`
Expected: FAIL due to missing validations and `playerName` field in `LobbyRoom.js`.

**Step 3: Write minimal implementation**

Modify `/home/behalr/titan-nexus-command/server/LobbyRoom.js`:
- In `claimSeat(slotIndex, token, socketId, playerName)`:
  - If `playerName` is not provided or empty (after trim), return `{ success: false, message: 'Name cannot be empty!' }`.
  - If `playerName.trim().length > 15`, return `{ success: false, message: 'Name must be 15 characters or less!' }`.
  - If another slot (which is not null and has a different token) has the same name (case-insensitively), return `{ success: false, message: 'Name is already taken!' }`.
  - Store the trimmed name: `this.slots[slotIndex] = { token, socketId, ready: false, team: defaultTeam, playerName: playerName.trim() };`

**Step 4: Run test to verify it passes**

Run: `npx vitest run server/lobby.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add server/LobbyRoom.js server/lobby.test.js
git commit -m "feat(lobby): validate and store custom player names in LobbyRoom"
```

---

### Task 2: Lobby Socket Handlers & Integration Tests

**Files:**
- Modify: `server/sockets/LobbyHandlers.js`
- Modify: `server/integration_lobby.test.js`

**Step 1: Write the failing test**

Modify `/home/behalr/titan-nexus-command/server/integration_lobby.test.js`:

```javascript
    it('should allow claiming a seat with a custom name', async () => {
        const update = await new Promise((resolve) => {
            client1.once('lobby:update', resolve);
            client1.emit('lobby:claimSeat', { slotIndex: 0, playerName: 'Commander X' });
        });
        expect(update.slots[0].playerName).toBe('Commander X');
    });
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run server/integration_lobby.test.js`
Expected: FAIL since `LobbyHandlers.js` expects a number index rather than an object payload.

**Step 3: Write minimal implementation**

Modify `/home/behalr/titan-nexus-command/server/sockets/LobbyHandlers.js`:
- In the `lobby:claimSeat` listener:
  - Handle payload as either an object `{ slotIndex, playerName }` or index (for backwards compatibility).
  - Extract `slotIndex` and `playerName`. If `playerName` is undefined, default to `Player <slotIndex + 1>`.
  - Call `room.claimSeat(slotIndex, socket.currentToken, socket.id, playerName)`.
  - If it fails, emit a `lobby:error` socket event to the client with the error message: `socket.emit('lobby:error', res.message)`.
  - If it succeeds, emit `lobby:update` to all sockets.
- In `lobby:autoJoin` listener:
  - If `options.playerName` is provided, pass it to `room.claimSeat`, otherwise pass a generated fallback name like `Pilot_${Math.floor(Math.random() * 9000 + 1000)}`.

**Step 4: Run test to verify it passes**

Run: `npx vitest run server/integration_lobby.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add server/sockets/LobbyHandlers.js server/integration_lobby.test.js
git commit -m "feat(lobby): support playerName payload and emit lobby errors on duplicate/invalid names"
```

---

### Task 3: Chat Handlers Custom Name Resolution

**Files:**
- Modify: `server/sockets/ChatHandlers.js`
- Modify: `server/lobby_chat.test.js`

**Step 1: Write the failing test**

Modify `/home/behalr/titan-nexus-command/server/lobby_chat.test.js`:
- Add a test verifying that when a client is in a lobby seat with a custom name, their sent chat messages resolve the sender name from their custom name.

```javascript
    it('should resolve senderName using custom lobby slot names', () => {
        const room = new LobbyRoom('test-room', 2);
        room.claimSeat(0, 'token-1', 'socket-1', 'Major Tom');

        // Verify that custom names are parsed correctly when registering messages
        const msg = room.addMessage('player1', 'Major Tom', 'Ground Control to Major Tom');
        expect(msg.senderName).toBe('Major Tom');
    });
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run server/lobby_chat.test.js`
Expected: FAIL or verify behavior fails in custom chat handlers integration tests.

**Step 3: Write minimal implementation**

Modify `/home/behalr/titan-nexus-command/server/sockets/ChatHandlers.js`:
- Resolve `senderName` dynamically:
  ```javascript
  const room = lobbyManager.getOrCreateRoom('default');
  const slot = room.slots.find(
      (s) => s && (s.socketId === socket.id || s.token === socket.currentToken)
  );
  if (slot && slot.playerName) {
      senderName = slot.playerName;
  } else if (context.matchStarted && socket.assignedPlayerId && socket.assignedPlayerId !== 'spectator') {
      const player = context.game.players[socket.assignedPlayerId];
      senderName = player?.name || socket.assignedPlayerId.replace('player', 'Player ');
  } else {
      senderName = `Spectator (${socket.id.slice(0, 4)})`;
  }
  ```

**Step 4: Run test to verify it passes**

Run: `npx vitest run server/lobby_chat.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add server/sockets/ChatHandlers.js server/lobby_chat.test.js
git commit -m "feat(chat): resolve custom player names dynamically for sent chat messages"
```

---

### Task 4: Match Startup and GameState Integration

**Files:**
- Modify: `shared/GameState.js`
- Modify: `server/index.js`
- Modify: `shared/tests/GameState.test.js`

**Step 1: Write the failing test**

Modify `/home/behalr/titan-nexus-command/shared/tests/GameState.test.js`:
- Add a test checking that custom player names are initialized within the game instance:

```javascript
    it('should assign custom player names during initializeGame', () => {
        const game = new GameState();
        game.initializeGame(['player1', 'player2'], null, null, {
            player1: 'Sergeant Avery',
            player2: 'Corporal Hicks'
        });
        expect(game.players.player1.name).toBe('Sergeant Avery');
        expect(game.players.player2.name).toBe('Corporal Hicks');
    });
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run shared/tests/GameState.test.js`
Expected: FAIL since `GameState.players[id].name` is undefined.

**Step 3: Write minimal implementation**

1. Modify `/home/behalr/titan-nexus-command/shared/GameState.js`:
   - In `initializeGame(playerIds, mapConfig = null, playerTeams = null, playerNames = null)`:
     ```javascript
     this.players[id] = {
         energy: GLOBAL_STATS.STARTING_ENERGY,
         color: `hsl(${index * 60}, 85%, 60%)`,
         alive: true,
         team: team || null,
         name: playerNames ? playerNames[id] : `Player ${index + 1}`
     };
     ```
2. Modify `/home/behalr/titan-nexus-command/server/index.js`:
   - In `startMatch()`:
     ```javascript
     const playerTeams = {};
     const playerNames = {};
     context.playerIds.forEach((pid, index) => {
         const slot = room.slots[index];
         context.playerAssignments[pid] = slot?.token || null;
         context.activeSockets[pid] = slot?.socketId || null;
         if (slot) {
             playerTeams[pid] = slot.team;
             playerNames[pid] = slot.playerName || `Player ${index + 1}`;
         }
     });

     context.game.initializeGame(context.playerIds, mapConfig, playerTeams, playerNames);
     ```

**Step 4: Run test to verify it passes**

Run: `npx vitest run shared/tests/GameState.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add shared/GameState.js server/index.js shared/tests/GameState.test.js
git commit -m "feat(game): forward custom player names to GameState players index"
```

---

### Task 5: Client UI & Socket Integration

**Files:**
- Modify: `client/src/hooks/useGameSocket.js`
- Modify: `client/src/components/LobbyOverlay.jsx`
- Modify: `client/src/components/LobbyOverlay.css`
- Modify: `client/src/components/HUD/SidebarLeft.jsx`
- Modify: `client/src/components/HUD/SidebarRight.jsx`

**Step 1: Write manual/build verification step**

We will verify client compilation and linting by running the client build.

Run: `npm run build --prefix client`
Expected: PASS

**Step 2: Run build to verify fails**

(Not applicable as we haven't changed code yet, but verify the baseline is passing).

**Step 3: Write minimal implementation**

1. Modify `client/src/hooks/useGameSocket.js`:
   - Keep track of an `error` listener or state, and subscribe to `lobby:error` socket event to set a local error banner/message if claiming fails.
   - Update `handleClaimSeat(index, playerName)` to emit:
     ```javascript
     socket.emit('lobby:claimSeat', { slotIndex: index, playerName });
     ```
   - Listen for `lobby:error` to set `lastError`.

2. Modify `client/src/components/LobbyOverlay.jsx`:
   - Add state for name input modal dialog visibility: `const [showNameModal, setShowNameModal] = useState(false);` and `const [targetSeatIndex, setTargetSeatIndex] = useState(null);`
   - Retrieve stored player name on click:
     ```javascript
     const savedName = localStorage.getItem('titan_nexus_player_name') || `Pilot_${Math.floor(Math.random() * 9000 + 1000)}`;
     ```
   - Build a custom CSS-styled React dialog for entering a name.
   - When a slot is occupied, display `slot.playerName` instead of `Player {index + 1}`.
   - Display a clean error message overlay or message box if `lastError` is set.

3. Modify `client/src/components/LobbyOverlay.css`:
   - Add styling matching the terminal theme for `.name-modal-backdrop`, `.name-modal-content`, `.name-input-field`, and confirmations.

4. Modify `client/src/components/HUD/SidebarLeft.jsx`:
   - Display custom player name in left HUD panel instead of raw player ID:
     ```jsx
     <span className="badge">{playerState?.players?.[myPlayerId]?.name || myPlayerId || 'Pending'}</span>
     ```

5. Modify `client/src/components/HUD/SidebarRight.jsx`:
   - Map sync status dots dynamically:
     ```jsx
     <div className="sync-monitor">
         {Object.keys(playerState?.players || { player1: {}, player2: {} }).map((pid) => {
             const p = playerState?.players?.[pid];
             const isReady = syncStatus?.lockedIn?.[pid];
             const name = p?.name || pid.replace('player', 'Player ');
             return (
                 <div
                     key={pid}
                     className={`player-dot ${isReady ? 'ready' : ''}`}
                     title={name}
                     style={p?.color ? { borderColor: p.color } : {}}
                 >
                     {name.slice(0, 2).toUpperCase()}
                 </div>
             );
         })}
     </div>
     ```

**Step 4: Run build to verify it passes**

Run: `npm run lint --prefix client && npm run build --prefix client`
Expected: PASS

**Step 5: Commit**

```bash
git add client/
git commit -m "feat(ui): add retro player name entry modal, store name in localStorage, and display custom names in HUD"
```
