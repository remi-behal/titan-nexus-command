# Server Modularization Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Decouple server/index.js into structured services, socket handlers, and single-session contexts.

**Architecture:** Extract server-side state, lobby and game socket event listeners, and tick timers into independent, modular files under server/context/, server/services/, and server/sockets/ directories. This isolates network booting from physical simulation coordination.

**Tech Stack:** Node.js, Express, Socket.io, Vitest

---

## Technical Design & Context Mapping

To isolate the multiple roles of `server/index.js`, we establish:
1. **`SessionContext`**: The single source of truth for running match states, player assignments, lock states, and safe network emit helpers.
2. **`TimerService`**: Manages the server turn timers, ticking clock cycles, and snapshots sequence timers.
3. **`LobbyHandlers`**: Manages socket registrations for seat claims, ready toggles, and customized maps.
4. **`GameHandlers`**: Manages socket updates for actions validation, submissions, and map editor blueprints.

---

## Tasks

### Task 1: Create SessionContext

**Files:**
- Create: `server/context/SessionContext.js`
- Test: `server/context/SessionContext.test.js`

**Step 1: Write the failing test**
Create `server/context/SessionContext.test.js` with verification checks:
```javascript
import { describe, it, expect } from 'vitest';
import { SessionContext } from './SessionContext.js';

describe('SessionContext State Holder', () => {
    it('should initialize empty player assignments and unlocked status', () => {
        const context = new SessionContext();
        expect(context.matchStarted).toBe(false);
        expect(context.lockedIn.player1).toBe(false);
        expect(context.playerAssignments.player1).toBeNull();
    });
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run server/context/SessionContext.test.js`
Expected: FAIL with "SessionContext is not defined" or similar.

**Step 3: Write minimal implementation**
Create `server/context/SessionContext.js`:
```javascript
import { GameState } from '../../shared/GameState.js';
import { LobbyManager } from '../LobbyManager.js';

export class SessionContext {
    constructor() {
        this.game = new GameState();
        this.lobbyManager = new LobbyManager();
        this.playerIds = ['player1', 'player2'];
        this.playerAssignments = { player1: null, player2: null };
        this.activeSockets = { player1: null, player2: null };
        this.turnActions = { player1: null, player2: null };
        this.lockedIn = { player1: false, player2: false };
        this.matchStarted = false;
        this.SIMULATED_LATENCY = parseInt(process.env.SIMULATED_LATENCY) || 0;
        this.TURN_DURATION = parseInt(process.env.TURN_DURATION) || 30;
        this.io = null;
    }

    safeEmit(emitter, event, data) {
        if (this.SIMULATED_LATENCY > 0) {
            setTimeout(() => emitter.emit(event, data), this.SIMULATED_LATENCY);
        } else {
            emitter.emit(event, data);
        }
    }

    emitFilteredState(state = null) {
        if (!this.matchStarted) return;
        const baseState = state || this.game.getState();

        this.io.sockets.sockets.forEach((socket) => {
            if (socket.assignedPlayerId) {
                this.safeEmit(socket, 'gameStateUpdate', this.game.getVisibleState(socket.assignedPlayerId, baseState));
            } else {
                this.safeEmit(socket, 'gameStateUpdate', baseState);
            }
        });
    }

    reset() {
        this.matchStarted = false;
        const room = this.lobbyManager.getOrCreateRoom('default');
        room.status = 'LOBBY';
        room.slots = new Array(room.maxPlayers).fill(null);
        this.playerAssignments = { player1: null, player2: null };
        this.activeSockets = { player1: null, player2: null };
        this.turnActions = { player1: null, player2: null };
        this.lockedIn = { player1: false, player2: false };
    }
}
```

**Step 4: Run test to verify it passes**
Run: `npx vitest run server/context/SessionContext.test.js`
Expected: PASS

**Step 5: Commit**
```bash
git add server/context/SessionContext.js server/context/SessionContext.test.js
git commit -m "feat(server): create SessionContext to encapsulate multiplayer session states"
```

---

### Task 2: Create TimerService

**Files:**
- Create: `server/services/TimerService.js`
- Test: `server/services/TimerService.test.js`

**Step 1: Write the failing test**
Create `server/services/TimerService.test.js` to verify scheduling calls:
```javascript
import { describe, it, expect, vi } from 'vitest';
import { TimerService } from './TimerService.js';
import { SessionContext } from '../context/SessionContext.js';

describe('TimerService Schedule loops', () => {
    it('should start timer with matching TURN_DURATION', () => {
        const context = new SessionContext();
        context.io = { emit: vi.fn() };
        const timer = new TimerService(context);
        timer.startTimer();
        expect(timer.timeRemaining).toBe(30);
        timer.stop();
    });
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run server/services/TimerService.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**
Create `server/services/TimerService.js`:
```javascript
export class TimerService {
    constructor(context) {
        this.context = context;
        this.timeRemaining = context.TURN_DURATION;
        this.timerTimeout = null;
        this.RESOLUTION_ROUND_DELAY = parseInt(process.env.RESOLUTION_ROUND_DELAY) || 2000;
        this.RESOLUTION_SUB_TICK_DELAY = parseInt(process.env.RESOLUTION_SUB_TICK_DELAY) || 60;
    }

    startTimer() {
        if (this.timerTimeout) {
            clearTimeout(this.timerTimeout);
            this.timerTimeout = null;
        }
        this.timeRemaining = this.context.TURN_DURATION;
        console.log(`[Timer] NEW TIMER START: ${this.timeRemaining}s`);
        this.context.safeEmit(this.context.io, 'timerUpdate', this.timeRemaining);
        this.timerTimeout = setTimeout(() => this.tick(), 1000);
    }

    tick() {
        this.timeRemaining--;
        this.context.safeEmit(this.context.io, 'timerUpdate', this.timeRemaining);

        if (this.timeRemaining <= 0) {
            console.log('[Timer] Time up!');
            this.resolveTurn();
        } else {
            this.timerTimeout = setTimeout(() => this.tick(), 1000);
        }
    }

    stop() {
        if (this.timerTimeout) {
            clearTimeout(this.timerTimeout);
            this.timerTimeout = null;
        }
    }

    async resolveTurn() {
        const { game, lockedIn, turnActions } = this.context;
        console.log(`[Server] resolveTurn called. Current Phase: ${game.phase}`);
        if (game.phase === 'RESOLVING') return;
        game.phase = 'RESOLVING';

        try {
            this.stop();

            const actionsMap = {
                player1: turnActions.player1 || [],
                player2: turnActions.player2 || []
            };

            let snapshots;
            try {
                snapshots = game.resolveTurn(actionsMap);
            } catch (err) {
                console.error('CRITICAL ERROR: GameState.resolveTurn failed:', err);
                snapshots = [{ type: 'FINAL', state: game.getState() }];
            }

            this.context.safeEmit(this.context.io, 'syncStatus', { lockedIn });
            this.context.safeEmit(this.context.io, 'resolutionStatus', { active: true, totalRounds: snapshots.length });

            for (const snap of snapshots) {
                this.context.emitFilteredState(snap.state);

                if (snap.type === 'ROUND_START' || snap.type === 'ROUND') {
                    this.context.safeEmit(this.context.io, 'resolutionRound', snap.round);
                }

                const delay = snap.type === 'ROUND_SUB' ? this.RESOLUTION_SUB_TICK_DELAY : this.RESOLUTION_ROUND_DELAY;
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        } finally {
            lockedIn.player1 = false;
            lockedIn.player2 = false;
            turnActions.player1 = [];
            turnActions.player2 = [];
            game.phase = 'PLANNING';

            this.context.emitFilteredState();
            this.context.safeEmit(this.context.io, 'syncStatus', { lockedIn });
            this.context.safeEmit(this.context.io, 'resolutionStatus', { active: false });

            this.startTimer();
        }
    }
}
```

**Step 4: Run test to verify it passes**
Run: `npx vitest run server/services/TimerService.test.js`
Expected: PASS

**Step 5: Commit**
```bash
git add server/services/TimerService.js server/services/TimerService.test.js
git commit -m "feat(server): create TimerService to handle turn ticking and round loops"
```

---

### Task 3: Create LobbyHandlers

**Files:**
- Create: `server/sockets/LobbyHandlers.js`

**Step 1: Write minimal implementation**
Create `server/sockets/LobbyHandlers.js` to register lobby socket listeners:
```javascript
export function registerLobbyHandlers(socket, io, context, timerService, startMatchCallback) {
    const { lobbyManager } = context;

    socket.on('lobby:autoJoin', (options = {}) => {
        const room = lobbyManager.getOrCreateRoom('default');
        let slotIndex = room.slots.findIndex(s => s === null);
        if (slotIndex === -1) return;

        const res = room.claimSeat(slotIndex, socket.currentToken, socket.id);
        if (res.success) {
            socket.assignedPlayerId = `player${slotIndex + 1}`;
            context.safeEmit(socket, 'playerAssignment', socket.assignedPlayerId);
            room.toggleReady(socket.id, true);
            io.emit('lobby:update', room.getUpdate());

            const filledSlots = room.slots.filter(s => s !== null);
            const allReady = filledSlots.every(s => s.ready);
            if (allReady && (filledSlots.length === 2 || options.force)) {
                startMatchCallback();
            }
        }
    });

    socket.on('lobby:claimSeat', (slotIndex) => {
        const room = lobbyManager.getOrCreateRoom('default');
        const res = room.claimSeat(slotIndex, socket.currentToken, socket.id);
        if (res.success) {
            socket.assignedPlayerId = `player${slotIndex + 1}`;
            context.safeEmit(socket, 'playerAssignment', socket.assignedPlayerId);
            io.emit('lobby:update', room.getUpdate());
        }
    });

    socket.on('lobby:ready', (isReady) => {
        const room = lobbyManager.getOrCreateRoom('default');
        if (room.toggleReady(socket.id, isReady)) {
            io.emit('lobby:update', room.getUpdate());

            const filledSlots = room.slots.filter(s => s !== null);
            if (filledSlots.length === 2 && filledSlots.every(s => s.ready)) {
                startMatchCallback();
            }
        }
    });

    socket.on('lobby:setMap', (mapName) => {
        const room = lobbyManager.getOrCreateRoom('default');
        const slot1 = room.slots[0];
        if (slot1 && slot1.socketId === socket.id) {
            room.setMap(mapName);
            io.emit('lobby:update', room.getUpdate());
        }
    });
}
```

**Step 2: Commit**
```bash
git add server/sockets/LobbyHandlers.js
git commit -m "feat(server): create LobbyHandlers for managing seats and maps settings"
```

---

### Task 4: Create GameHandlers

**Files:**
- Create: `server/sockets/GameHandlers.js`

**Step 1: Write minimal implementation**
Create `server/sockets/GameHandlers.js` exposing action validation and planning phase locks:
```javascript
import { ENTITY_STATS } from '../../shared/constants/EntityStats.js';
import { mapService } from '../MapService.js';

export function registerGameHandlers(socket, io, context, timerService) {
    const { game, lockedIn, turnActions } = context;

    socket.on('requestState', () => {
        if (!context.matchStarted) return;
        context.safeEmit(
            socket,
            'gameStateUpdate',
            socket.assignedPlayerId && socket.assignedPlayerId !== 'spectator'
                ? game.getVisibleState(socket.assignedPlayerId)
                : game.getState()
        );
        context.safeEmit(socket, 'playerAssignment', socket.assignedPlayerId || 'spectator');
        const filteredLockedIn = {
            player1: lockedIn.player1,
            player2: lockedIn.player2
        };
        context.safeEmit(socket, 'syncStatus', { lockedIn: filteredLockedIn });
    });

    socket.on('syncActions', (actions) => {
        if (!context.matchStarted || game.phase !== 'PLANNING') return;
        if (!socket.assignedPlayerId || socket.assignedPlayerId === 'spectator') return;
        if (lockedIn[socket.assignedPlayerId]) return;

        turnActions[socket.assignedPlayerId] = actions;
    });

    socket.on('passTurn', () => {
        if (!context.matchStarted || game.phase !== 'PLANNING') return;
        if (socket.assignedPlayerId !== 'player1' && socket.assignedPlayerId !== 'player2') return;

        console.log(`[Server] Player ${socket.assignedPlayerId} PASSED turn`);
        lockedIn[socket.assignedPlayerId] = true;
        turnActions[socket.assignedPlayerId] = [];

        const filteredLockedIn = {
            player1: lockedIn.player1,
            player2: lockedIn.player2
        };
        context.safeEmit(io, 'syncStatus', { lockedIn: filteredLockedIn });

        if (lockedIn.player1 && lockedIn.player2) {
            timerService.resolveTurn();
        }
    });

    socket.on('submitActions', (actions) => {
        if (!context.matchStarted || game.phase !== 'PLANNING') return;
        if (socket.assignedPlayerId !== 'player1' && socket.assignedPlayerId !== 'player2') return;

        const validatedActions = [];
        let totalCost = 0;
        const player = game.players[socket.assignedPlayerId];

        for (const action of actions) {
            const sourceEntity = game.entities.find((e) => e.id === action.sourceId);
            if (!sourceEntity || sourceEntity.owner !== socket.assignedPlayerId) continue;

            const cost = ENTITY_STATS[action.itemType]?.cost || 0;
            if (player.energy < totalCost + cost) continue;

            totalCost += cost;
            validatedActions.push({ ...action, playerId: socket.assignedPlayerId });
        }

        turnActions[socket.assignedPlayerId] = validatedActions;
        lockedIn[socket.assignedPlayerId] = true;

        const filteredLockedIn = {
            player1: lockedIn.player1,
            player2: lockedIn.player2
        };
        context.safeEmit(io, 'syncStatus', { lockedIn: filteredLockedIn });

        if (lockedIn.player1 && lockedIn.player2) {
            timerService.resolveTurn();
        }
    });

    socket.on('map:save', ({ name, data }) => {
        try {
            const fileName = mapService.saveMap(name, data);
            socket.emit('map:saveSuccess', fileName);
        } catch (err) {
            socket.emit('map:saveError', err.message);
        }
    });

    socket.on('map:list', () => {
        const maps = mapService.listMaps();
        socket.emit('map:listUpdate', maps);
    });

    socket.on('room:listMaps', () => {
        const maps = mapService.listReadyMaps();
        socket.emit('room:mapsUpdate', maps);
    });
}
```

**Step 2: Commit**
```bash
git add server/sockets/GameHandlers.js
git commit -m "feat(server): create GameHandlers for validations and planning phase submissions"
```

---

### Task 5: Decouple server/index.js

**Files:**
- Modify: `server/index.js`

**Step 1: Write minimal integration delegate**
Replace the entire contents of `server/index.js` with:
```javascript
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { SessionContext } from './context/SessionContext.js';
import { TimerService } from './services/TimerService.js';
import { registerLobbyHandlers } from './sockets/LobbyHandlers.js';
import { registerGameHandlers } from './sockets/GameHandlers.js';
import { mapService } from './MapService.js';

const app = express();
app.use(cors());

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;

const context = new SessionContext();
context.io = io;
const timerService = new TimerService(context);

function startMatch() {
    console.log('[Lobby] Starting match...');
    const room = context.lobbyManager.getOrCreateRoom('default');

    context.playerAssignments.player1 = room.slots[0]?.token || null;
    context.playerAssignments.player2 = room.slots[1]?.token || null;
    context.activeSockets.player1 = room.slots[0]?.socketId || null;
    context.activeSockets.player2 = room.slots[1]?.socketId || null;

    let mapConfig = null;
    if (room.selectedMapName) {
        mapConfig = mapService.loadReadyMap(room.selectedMapName);
    }

    context.game.initializeGame(context.playerIds, mapConfig);
    context.matchStarted = true;
    room.status = 'IN_GAME';

    context.safeEmit(io, 'matchStarted', { playerAssignments: context.playerAssignments });

    context.playerIds.forEach(pid => {
        const sid = context.activeSockets[pid];
        if (sid) {
            const socket = io.sockets.sockets.get(sid);
            if (socket) {
                socket.assignedPlayerId = pid;
                context.safeEmit(socket, 'playerAssignment', pid);
            }
        }
    });

    context.emitFilteredState();
    timerService.startTimer();
}

io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    socket.on('authenticate', (token) => {
        if (!token) return;
        socket.currentToken = token;
        const room = context.lobbyManager.getOrCreateRoom('default');

        if (context.matchStarted) {
            socket.assignedPlayerId = Object.keys(context.playerAssignments).find(
                (pid) => context.playerAssignments[pid] === token
            ) || 'spectator';

            if (socket.assignedPlayerId !== 'spectator') {
                context.activeSockets[socket.assignedPlayerId] = socket.id;
                context.safeEmit(socket, 'playerAssignment', socket.assignedPlayerId);
                context.safeEmit(socket, 'gameStateUpdate', context.game.getVisibleState(socket.assignedPlayerId));
            } else {
                context.safeEmit(socket, 'playerAssignment', 'spectator');
                context.safeEmit(socket, 'gameStateUpdate', context.game.getState());
            }
            context.safeEmit(socket, 'lobby:update', room.getUpdate());

            const filteredLockedIn = {
                player1: context.lockedIn.player1,
                player2: context.lockedIn.player2
            };
            context.safeEmit(io, 'syncStatus', { lockedIn: filteredLockedIn });
        } else {
            const reservedSlotIndex = room.slots.findIndex(s => s && s.token === token);
            if (reservedSlotIndex !== -1) {
                socket.assignedPlayerId = `player${reservedSlotIndex + 1}`;
                room.slots[reservedSlotIndex].socketId = socket.id;
                context.safeEmit(socket, 'playerAssignment', socket.assignedPlayerId);
            } else if (room.slots.filter(s => s !== null).length >= room.maxPlayers) {
                socket.assignedPlayerId = 'spectator';
                context.safeEmit(socket, 'spectator');
            } else {
                context.safeEmit(socket, 'playerAssignment', null);
            }
            context.safeEmit(socket, 'lobby:update', room.getUpdate());
        }
    });

    registerLobbyHandlers(socket, io, context, timerService, startMatch);
    registerGameHandlers(socket, io, context, timerService);

    socket.on('restartGame', () => {
        timerService.stop();
        context.reset();
        io.sockets.sockets.forEach(s => { s.assignedPlayerId = null; });
        io.emit('lobby:update', context.lobbyManager.getOrCreateRoom('default').getUpdate());
        io.emit('matchRestarted');
    });

    socket.on('disconnect', () => {
        console.log(`User Disconnected: ${socket.id}`);
        if (!context.matchStarted) {
            context.lobbyManager.handleSocketDisconnect(socket.id);
            io.emit('lobby:update', context.lobbyManager.getOrCreateRoom('default').getUpdate());
        } else if (socket.assignedPlayerId) {
            if (context.activeSockets[socket.assignedPlayerId] === socket.id) {
                context.activeSockets[socket.assignedPlayerId] = null;
            }
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`SERVER RUNNING ON PORT ${PORT} (0.0.0.0)`);
});
```

**Step 2: Run all server integration tests to verify correctness**
Run: `npm test`
Expected: ALL backend and simulation integration tests pass seamlessly (100% green).

**Step 3: Commit**
```bash
git add server/index.js
git commit -m "refactor(server): decouple express, timers, and sockets out of server index index"
```
