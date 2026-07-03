# Team Play (Alliance Mode) Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Implement Alliance/Team Play Mode where players can join Team A or Team B, sharing Fog of War vision and win/loss conditions while maintaining separate energy, hubs, and experiencing link collisions.

**Architecture:** We will extend the LobbyRoom and GameState structures to support player teams and enforce size limits. The VisibilitySystem will be updated to merge vision for teammates and bypass teammate cloaks, and the GameState win/draw detection will group players by team to evaluate team-level victory. Finally, React overlays will be updated to display and edit teammate options.

**Tech Stack:** React, Socket.io, Node.js, Vitest

---

### Task 1: Server Lobby & Socket Handling

**Files:**
- Modify: `server/LobbyRoom.js`
- Modify: `server/sockets/LobbyHandlers.js`
- Modify: `server/context/SessionContext.js`
- Test: `server/lobby.test.js`

**Step 1: Write the failing test**
Add tests to `server/lobby.test.js` asserting:
1. Seats default to 'Team A' (for slots 0-3) and 'Team B' (for slots 4-7).
2. Socket clients can update their team using `setTeam(socketId, team, maxPlayersPerTeam)`.
3. Team updates fail and return false if the team is already at the maximum size limit.

```javascript
    it('should set team for a seat with size limit enforcement', () => {
        const room = new LobbyRoom('test-room', 8);
        room.claimSeat(0, 'token-1', 'socket-1');
        room.claimSeat(1, 'token-2', 'socket-2');
        
        // Assert defaults
        expect(room.slots[0].team).toBe('Team A');
        expect(room.slots[1].team).toBe('Team A');

        // Set team successfully
        const ok = room.setTeam('socket-1', 'Team B', 2);
        expect(ok).toBe(true);
        expect(room.slots[0].team).toBe('Team B');

        // Over-limit set should fail
        room.claimSeat(2, 'token-3', 'socket-3');
        room.setTeam('socket-2', 'Team B', 2); // Now Team B has 2 players
        
        const overLimit = room.setTeam('socket-3', 'Team B', 2);
        expect(overLimit).toBe(false);
    });
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run server/lobby.test.js`
Expected: FAIL due to missing `setTeam` and default `team` fields.

**Step 3: Write minimal implementation**
1. Modify `server/LobbyRoom.js`:
   - Initialize slots with default teams in `claimSeat`: slots 0-3 default to `'Team A'`, slots 4-7 default to `'Team B'`.
   - Implement `setTeam(socketId, team, maxPlayersPerTeam)` to track player counts and enforce size limits.
2. Modify `server/sockets/LobbyHandlers.js`:
   - Register a `lobby:setTeam` socket listener which calls `room.setTeam`, updates slot info, and emits `lobby:update`.
3. Modify `server/context/SessionContext.js`:
   - Scale `playerIds` and initialization fields to support up to 8 players.

**Step 4: Run test to verify it passes**
Run: `npx vitest run server/lobby.test.js`
Expected: PASS

**Step 5: Commit**
```bash
git add server/LobbyRoom.js server/sockets/LobbyHandlers.js server/context/SessionContext.js server/lobby.test.js
git commit -m "feat(lobby): implement team assignment and size limits in LobbyRoom"
```

---

### Task 2: Core GameState & Starting Base Assignment

**Files:**
- Modify: `shared/GameState.js`
- Create: `shared/tests/TeamGameState.test.js`

**Step 1: Write the failing test**
Create `shared/tests/TeamGameState.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { GameState } from '../GameState.js';

describe('GameState - Team Starting Base Assignment', () => {
    it('should assign starting bases based on player team selection', () => {
        const game = new GameState();
        const mapConfig = {
            width: 2000,
            height: 2000,
            playerBases: [
                { id: 'b1', x: 100, y: 500, team: 'Team A' },
                { id: 'b2', x: 200, y: 500, team: 'Team A' },
                { id: 'b3', x: 1800, y: 500, team: 'Team B' }
            ]
        };

        // Initialize players with assigned teams
        const playerIds = ['p1', 'p2', 'p3'];
        game.initializeGame(playerIds, mapConfig);
        
        // Set player team settings
        game.players['p1'].team = 'Team A';
        game.players['p2'].team = 'Team B';
        game.players['p3'].team = 'Team A';

        // Re-run base positioning or check assigned hubs
        // We will mock/adjust initializeGame so that team information is passed during initializeGame or set beforehand
    });
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run shared/tests/TeamGameState.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**
1. Modify `shared/GameState.js`:
   - In `initializeGame(playerIds, mapConfig)`, accept player team metadata (e.g. `playerTeams = { playerId: team }` or pass `players` array with team info). Let's pass teammate metadata, or parse slot configurations.
   - Filter `playerBases` by team and assign starting bases matching the player's team. Fall back to standard sequential assignment if bases do not have team labels.
   - Update default hardcoded layout to register 8 bases (4 on left for Team A, 4 on right for Team B).

**Step 4: Run test to verify it passes**
Run: `npx vitest run shared/tests/TeamGameState.test.js`
Expected: PASS

**Step 5: Commit**
```bash
git add shared/GameState.js shared/tests/TeamGameState.test.js
git commit -m "feat(game): implement team starting base assignment and default 8-player map"
```

---

### Task 3: Shared Vision & Cloaking in VisibilitySystem

**Files:**
- Modify: `shared/systems/VisibilitySystem.js`
- Create: `shared/tests/TeamVisibility.test.js`

**Step 1: Write the failing test**
Create `shared/tests/TeamVisibility.test.js` asserting:
1. `isPositionVisible` returns true for a player if any teammate sees the coordinate.
2. `getVisionCircles` aggregates vision circles from all teammates.
3. Teammates can see each other's cloaked entities (exemption from cloaking filter in `getVisibleState`).

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';

describe('VisibilitySystem - Team Shared Vision', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['p1', 'p2', 'p3']);
        game.players['p1'].team = 'Team A';
        game.players['p2'].team = 'Team A';
        game.players['p3'].team = 'Team B';
    });

    it('should share vision between teammates', () => {
        // Move p2's hub to see coordinates that p1's hub cannot see
        const p2Hub = game.entities.find(e => e.owner === 'p2');
        p2Hub.x = 1000;
        p2Hub.y = 1000;

        // Coordinates (1050, 1000) are near p2 (dist 50, vision 400), but far from p1 (250, 500)
        expect(game.isPositionVisible('p1', 1050, 1000)).toBe(true);
        expect(game.isPositionVisible('p3', 1050, 1000)).toBe(false); // enemy teammate p3 cannot see it
    });
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run shared/tests/TeamVisibility.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**
1. Modify `shared/systems/VisibilitySystem.js`:
   - In `isPositionVisible(gameState, playerId, x, y, entities)`, find `playerId`'s team and search for active entities owned by any player on the same team.
   - In `getVisionCircles(gameState, playerId)`, filter and include vision circles of all players sharing `playerId`'s team.
   - In `getVisibleState(gameState, playerId, baseState)`, verify that if `targetOwnerId` is on the same team as `playerId`, they bypass Cloaking Field checks.
   - In `updateScouting`, update teammate check logic so that teammates don't need to scout teammate structures.

**Step 4: Run test to verify it passes**
Run: `npx vitest run shared/tests/TeamVisibility.test.js`
Expected: PASS

**Step 5: Commit**
```bash
git add shared/systems/VisibilitySystem.js shared/tests/TeamVisibility.test.js
git commit -m "feat(vision): implement shared Fog of War vision and cloaking exemption for teammates"
```

---

### Task 4: Team Win/Loss Evaluation

**Files:**
- Modify: `shared/GameState.js`
- Test: Add tests to `shared/tests/TeamGameState.test.js`

**Step 1: Write the failing test**
Add a team win/loss test to `shared/tests/TeamGameState.test.js`:
```javascript
    it('should resolve team-level victory when all opposing team members have lost all hubs', () => {
        const game = new GameState();
        game.initializeGame(['p1', 'p2', 'p3']);
        game.players['p1'].team = 'Team A';
        game.players['p2'].team = 'Team A';
        game.players['p3'].team = 'Team B';

        // Destroy p3's hub (Team B)
        game.entities = game.entities.filter(e => e.owner !== 'p3');

        // Resolve turn with empty actions
        game.resolveTurn({});

        expect(game.winner).toBe('Team A');
    });
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run shared/tests/TeamGameState.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**
1. Modify `shared/GameState.js` in `resolveTurn` after determining alive players:
   - Group alive players by their `team`. If a player has no team, treat their player ID as their team.
   - Check the number of remaining teams with active hubs.
   - If only one team remains, set `this.winner` to that team's ID/name (e.g. `'Team A'`).
   - If no teams remain, set `this.winner = 'DRAW'`.

**Step 4: Run test to verify it passes**
Run: `npx vitest run shared/tests/TeamGameState.test.js`
Expected: PASS

**Step 5: Commit**
```bash
git add shared/GameState.js shared/tests/TeamGameState.test.js
git commit -m "feat(game): implement team-level win/loss evaluation in GameState"
```

---

### Task 5: Client UI & Socket Integration

**Files:**
- Modify: `client/src/components/LobbyOverlay.jsx`
- Modify: `client/src/components/LobbyOverlay.css`
- Modify: `client/src/App.jsx`
- Modify: `client/src/hooks/useGameSocket.js`

**Step 1: Write manual/integration verification tests**
No Vitest component testing is required, but we must verify that:
1. The Lobby overlay renders a "Team" toggle next to claimed seats.
2. Clicking the toggle successfully updates the team state on the server and broadcasts the update.
3. The winner overlay displays "{Winner Team} has conquered the sector." when a team wins.
4. Run ESLint/formatter to ensure there are no syntax/style issues.

**Step 2: Implement UI updates**
1. Modify `client/src/components/LobbyOverlay.jsx`:
   - For occupied slots, render a dropdown or toggle button: `Team A / Team B`.
   - Clicking this dropdown calls an callback `onSetTeam(slotIndex, newTeam)`.
   - Enforce disabled states for other player's seats.
2. Modify `client/src/hooks/useGameSocket.js`:
   - Expose `onSetTeam` which emits a `lobby:setTeam` event.
3. Modify `client/src/App.jsx`:
   - Bind `onSetTeam` to the LobbyOverlay component.
   - Update the winner overlay message to display team-level wins nicely.
4. Modify `client/src/components/LobbyOverlay.css`:
   - Add styles for the team toggle controls to match the terminal theme.

**Step 3: Verify build and runs**
Run: `npm run lint`
Expected: SUCCESS

**Step 4: Commit**
```bash
git add client/src/components/LobbyOverlay.jsx client/src/components/LobbyOverlay.css client/src/App.jsx client/src/hooks/useGameSocket.js
git commit -m "feat(ui): add team toggling in lobby and display team victory in App UI"
```
