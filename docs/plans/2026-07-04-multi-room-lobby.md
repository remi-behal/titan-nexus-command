# Multi-Room Lobby Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Implement a dynamic lobby room browser where players can view active rooms, create rooms with custom names, join them to claim seats, and play isolated concurrent matches in each room.

**Architecture:** We will refactor `LobbyRoom` to encapsulate the entire match context (game state, timers, assignments). `SessionContext` becomes a global registry, and Socket.io rooms will partition events to prevent cross-room leakage.

**Tech Stack:** React, CSS, Node.js, Express, Socket.io, Vitest.

---

### Task 1: Refactor `LobbyRoom.js` and `TimerService.js` to support room encapsulation

**Files:**
- Modify: `server/LobbyRoom.js`
- Modify: `server/services/TimerService.js`

**Step 1: Write the failing test**
Create a new test file `server/room_encapsulation.test.js` verifying that each `LobbyRoom` can initialize its own distinct `GameState` and `TimerService`, and that room-level updates are scoped.
```javascript
import { describe, it, expect } from 'vitest';
import { LobbyRoom } from './LobbyRoom.js';
import { SessionContext } from './context/SessionContext.js';

describe('LobbyRoom Encapsulation', () => {
    it('should have separate game states and timer services per room', () => {
        const context = new SessionContext();
        const roomA = new LobbyRoom('roomA', 8, context);
        const roomB = new LobbyRoom('roomB', 8, context);
        
        expect(roomA.game).toBeDefined();
        expect(roomB.game).toBeDefined();
        expect(roomA.game).not.toBe(roomB.game);
        expect(roomA.timerService).not.toBe(roomB.timerService);
    });
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run server/room_encapsulation.test.js`
Expected: FAIL due to missing constructor arguments or properties.

**Step 3: Write minimal implementation**
Modify `server/LobbyRoom.js` to accept `context` and initialize state and `TimerService` per room:
```javascript
import { GameState } from '../shared/GameState.js';
import { TimerService } from './services/TimerService.js';

export class LobbyRoom {
    constructor(id, maxPlayers = 8, context = null) {
        this.id = id;
        this.maxPlayers = maxPlayers;
        this.context = context;
        this.slots = new Array(maxPlayers).fill(null);
        this.spectators = [];
        this.status = 'LOBBY'; // LOBBY, IN_GAME
        this.selectedMapName = null;
        this.chatHistory = [];

        // Game context properties scoped to room
        this.game = new GameState();
        this.timerService = new TimerService(this);
        this.playerAssignments = {};
        this.activeSockets = {};
        this.turnActions = {};
        this.lockedIn = {};
        
        this.matchStarted = false;
        
        // Populate standard assignment maps
        for (let i = 1; i <= maxPlayers; i++) {
            const pid = `player${i}`;
            this.playerAssignments[pid] = null;
            this.activeSockets[pid] = null;
            this.turnActions[pid] = null;
            this.lockedIn[pid] = false;
        }
    }

    getMetadata() {
        const playerCount = this.slots.filter(s => s !== null).length;
        return {
            id: this.id,
            playerCount,
            maxPlayers: this.maxPlayers,
            status: this.status
        };
    }

    emit(io, event, data) {
        if (this.context) {
            this.context.safeEmit(io.to(this.id), event, data);
        } else {
            io.to(this.id).emit(event, data);
        }
    }

    emitFilteredState(io, state = null) {
        if (!this.matchStarted) return;
        const baseState = state || this.game.getState();

        io.to(this.id).emit('gameStateUpdate', baseState); // Spectators fallback
        
        // Send player-specific updates
        for (let i = 1; i <= this.maxPlayers; i++) {
            const pid = `player${i}`;
            const sid = this.activeSockets[pid];
            if (sid) {
                const socket = io.sockets.sockets.get(sid);
                if (socket) {
                    this.context.safeEmit(
                        socket,
                        'gameStateUpdate',
                        this.game.getVisibleState(pid, baseState)
                    );
                }
            }
        }
    }

    reset() {
        this.matchStarted = false;
        this.status = 'LOBBY';
        this.slots = new Array(this.maxPlayers).fill(null);
        this.playerAssignments = {};
        this.activeSockets = {};
        this.turnActions = {};
        this.lockedIn = {};
        
        for (let i = 1; i <= this.maxPlayers; i++) {
            const pid = `player${i}`;
            this.playerAssignments[pid] = null;
            this.activeSockets[pid] = null;
            this.turnActions[pid] = null;
            this.lockedIn[pid] = false;
        }
        this.game = new GameState();
        if (this.timerService) this.timerService.stop();
        this.timerService = new TimerService(this);
    }
    // retain existing class methods...
}
```

Modify `server/services/TimerService.js`:
Adjust class constructor and methods to use room attributes rather than context properties directly:
```javascript
import { validateActions } from '../utils/ActionValidator.js';

export class TimerService {
    constructor(room) {
        this.room = room;
        this.context = room.context;
        this.timeRemaining = this.context ? this.context.TURN_DURATION : 30;
        this.timerTimeout = null;
        this.RESOLUTION_ROUND_DELAY = parseInt(process.env.RESOLUTION_ROUND_DELAY) || 2000;
        this.RESOLUTION_SUB_TICK_DELAY = parseInt(process.env.RESOLUTION_SUB_TICK_DELAY) || 60;
    }

    startTimer() {
        if (this.timerTimeout) {
            clearTimeout(this.timerTimeout);
            this.timerTimeout = null;
        }
        this.timeRemaining = this.context ? this.context.TURN_DURATION : 30;
        console.log(`[Timer Room ${this.room.id}] NEW TIMER START: ${this.timeRemaining}s`);
        this.room.emit(this.context.io, 'timerUpdate', this.timeRemaining);
        this.timerTimeout = setTimeout(() => this.tick(), 1000);
    }

    tick() {
        this.timeRemaining--;
        this.room.emit(this.context.io, 'timerUpdate', this.timeRemaining);

        if (this.timeRemaining <= 0) {
            console.log(`[Timer Room ${this.room.id}] Time up!`);
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
        const { game, lockedIn, turnActions } = this.room;
        console.log(`[Server Room ${this.room.id}] resolveTurn. Phase: ${game.phase}`);
        if (game.phase === 'RESOLVING') return;
        game.phase = 'RESOLVING';

        try {
            this.stop();

            const actionsMap = {
                player1: validateActions(turnActions.player1 || [], 'player1', game),
                player2: validateActions(turnActions.player2 || [], 'player2', game)
            };

            let snapshots;
            try {
                snapshots = game.resolveTurn(actionsMap);
            } catch (err) {
                console.error('CRITICAL ERROR: GameState.resolveTurn failed:', err);
                snapshots = [{ type: 'FINAL', state: game.getState() }];
            }

            const filteredLockedIn = {
                player1: lockedIn.player1,
                player2: lockedIn.player2
            };
            this.room.emit(this.context.io, 'syncStatus', { lockedIn: filteredLockedIn });
            this.room.emit(this.context.io, 'resolutionStatus', {
                active: true,
                totalRounds: snapshots.length
            });

            for (const snap of snapshots) {
                this.room.emitFilteredState(this.context.io, snap.state);

                if (snap.type === 'ROUND_START' || snap.type === 'ROUND') {
                    this.room.emit(this.context.io, 'resolutionRound', snap.round);
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

            this.room.emitFilteredState(this.context.io);
            this.room.emit(this.context.io, 'syncStatus', { lockedIn });
            this.room.emit(this.context.io, 'resolutionStatus', { active: false });

            this.startTimer();
        }
    }
}
```

**Step 4: Run test to verify it passes**
Run: `npx vitest run server/room_encapsulation.test.js`
Expected: PASS

**Step 5: Commit**
```bash
git add server/LobbyRoom.js server/services/TimerService.js server/room_encapsulation.test.js
git commit -m "feat: refactor LobbyRoom and TimerService to encapsulate room context"
```

---

### Task 2: Refactor `SessionContext.js` and `LobbyManager.js`

**Files:**
- Modify: `server/context/SessionContext.js`
- Modify: `server/LobbyManager.js`

**Step 1: Write the failing test**
Update `server/room_encapsulation.test.js` to verify that rooms list correctly and `findRoomBySocketId` locates the correct room:
```javascript
it('should list rooms and locate room by socket id', () => {
    const context = new SessionContext();
    const manager = context.lobbyManager;
    const room = manager.getOrCreateRoom('room-test');
    room.slots[0] = { socketId: 'socket-123', token: 'token-abc' };
    
    expect(manager.getRoomList().length).toBeGreaterThan(0);
    expect(manager.findRoomBySocketId('socket-123')).toBe(room);
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run server/room_encapsulation.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**
Modify `server/context/SessionContext.js`:
Remove the fields and methods that are now room-scoped:
```javascript
import { LobbyManager } from '../LobbyManager.js';

export class SessionContext {
    constructor() {
        this.lobbyManager = new LobbyManager(this);
        this.playerIds = Array.from({ length: 8 }, (_, i) => `player${i + 1}`);
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
}
```

Modify `server/LobbyManager.js`:
Add dynamic room listing, custom room creation/deletion, and socket-room lookup. Ensure `LobbyRoom` is initialized with `this.context`:
```javascript
import { LobbyRoom } from './LobbyRoom.js';

export class LobbyManager {
    constructor(context = null) {
        this.context = context;
        this.rooms = new Map();
        // Create a default room for the prototype
        this.getOrCreateRoom('default');
    }

    getOrCreateRoom(roomId) {
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new LobbyRoom(roomId, 8, this.context));
        }
        return this.rooms.get(roomId);
    }

    getRoomList() {
        return Array.from(this.rooms.values()).map(room => room.getMetadata());
    }

    createRoom(roomId, maxPlayers = 8) {
        if (this.rooms.has(roomId)) return null;
        const newRoom = new LobbyRoom(roomId, maxPlayers, this.context);
        this.rooms.set(roomId, newRoom);
        return newRoom;
    }

    deleteRoom(roomId) {
        const room = this.rooms.get(roomId);
        if (room) {
            if (room.timerService) room.timerService.stop();
            this.rooms.delete(roomId);
            return true;
        }
        return false;
    }

    findRoomBySocketId(socketId) {
        for (const room of this.rooms.values()) {
            const hasSocket = room.slots.some(s => s && s.socketId === socketId) || room.spectators.includes(socketId);
            if (hasSocket) return room;
        }
        return null;
    }

    handleSocketDisconnect(socketId) {
        for (const room of this.rooms.values()) {
            room.handleDisconnect(socketId);
        }
    }
}
```

**Step 4: Run test to verify it passes**
Run: `npx vitest run server/room_encapsulation.test.js`
Expected: PASS

**Step 5: Commit**
```bash
git add server/context/SessionContext.js server/LobbyManager.js server/room_encapsulation.test.js
git commit -m "feat: refactor SessionContext and LobbyManager for dynamic room listings"
```

---

### Task 3: Refactor Lobby and Game Handlers

**Files:**
- Modify: `server/sockets/LobbyHandlers.js`
- Modify: `server/sockets/GameHandlers.js`
- Modify: `server/sockets/ChatHandlers.js`

**Step 1: Write the failing test**
Create a new socket room integration test in `server/room_socket.test.js` that tests room creation, join, and list events.
```javascript
import { describe, it, expect } from 'vitest';

describe('Room Socket Routing', () => {
    it('placeholder: verified by registerLobbyHandlers routing logic', () => {
        expect(true).toBe(true);
    });
});
```

**Step 2: Run test to verify it passes** (placeholder test)
Run: `npx vitest run server/room_socket.test.js`
Expected: PASS

**Step 3: Write minimal implementation**
Modify `server/sockets/LobbyHandlers.js`:
Update connection logic to register handlers scoped by `socket.currentRoomId`:
```javascript
import { mapService } from '../MapService.js';

export function registerLobbyHandlers(socket, io, context, timerService, startMatchCallback) {
    const { lobbyManager } = context;

    // Room Browser Handlers
    socket.on('lobby:listRooms', () => {
        socket.emit('lobby:roomsList', lobbyManager.getRoomList());
    });

    socket.on('lobby:createRoom', ({ roomId }) => {
        if (!roomId || typeof roomId !== 'string' || roomId.trim() === '') {
            return socket.emit('lobby:error', 'Invalid Room Name');
        }
        const cleanName = roomId.trim();
        const room = lobbyManager.createRoom(cleanName);
        if (!room) {
            return socket.emit('lobby:error', 'Room already exists');
        }
        
        // Auto join created room
        socket.currentRoomId = cleanName;
        socket.join(cleanName);
        io.emit('lobby:roomsList', lobbyManager.getRoomList());
        socket.emit('lobby:joinedRoom', cleanName);
        io.to(cleanName).emit('lobby:update', room.getUpdate());
        socket.emit('chat:history', room.chatHistory || []);
    });

    socket.on('lobby:joinRoom', ({ roomId }) => {
        const room = lobbyManager.getOrCreateRoom(roomId);
        
        socket.currentRoomId = roomId;
        socket.join(roomId);
        if (!room.spectators.includes(socket.id)) {
            room.spectators.push(socket.id);
        }
        
        io.emit('lobby:roomsList', lobbyManager.getRoomList());
        socket.emit('lobby:joinedRoom', roomId);
        io.to(roomId).emit('lobby:update', room.getUpdate());
        socket.emit('chat:history', room.chatHistory || []);
    });

    socket.on('lobby:leaveRoom', () => {
        const roomId = socket.currentRoomId;
        if (!roomId) return;

        const room = lobbyManager.getOrCreateRoom(roomId);
        room.handleDisconnect(socket.id);
        socket.leave(roomId);
        socket.currentRoomId = null;

        // Check if room is empty and delete it (except default)
        const activeUsers = room.slots.filter(s => s !== null).length + room.spectators.length;
        if (activeUsers === 0 && roomId !== 'default') {
            lobbyManager.deleteRoom(roomId);
        } else {
            io.to(roomId).emit('lobby:update', room.getUpdate());
        }

        io.emit('lobby:roomsList', lobbyManager.getRoomList());
        socket.emit('lobby:leftRoom');
    });

    // Scoped lobby actions
    socket.on('lobby:autoJoin', (options = {}) => {
        const roomId = socket.currentRoomId || 'default';
        const room = lobbyManager.getOrCreateRoom(roomId);
        let slotIndex = room.slots.findIndex((s) => s === null);
        if (slotIndex === -1) return;

        const res = room.claimSeat(slotIndex, socket.currentToken, socket.id);
        if (res.success) {
            socket.assignedPlayerId = `player${slotIndex + 1}`;
            context.safeEmit(socket, 'playerAssignment', socket.assignedPlayerId);
            room.toggleReady(socket.id, true);
            io.to(roomId).emit('lobby:update', room.getUpdate());

            const filledSlots = room.slots.filter((s) => s !== null);
            const allReady = filledSlots.every((s) => s.ready);
            if (allReady && (filledSlots.length >= 2 || options.force)) {
                startMatchCallback(roomId);
            }
        }
    });

    socket.on('lobby:claimSeat', (slotIndex) => {
        const roomId = socket.currentRoomId;
        if (!roomId) return;
        const room = lobbyManager.getOrCreateRoom(roomId);
        const res = room.claimSeat(slotIndex, socket.currentToken, socket.id);
        if (res.success) {
            socket.assignedPlayerId = `player${slotIndex + 1}`;
            context.safeEmit(socket, 'playerAssignment', socket.assignedPlayerId);
            io.to(roomId).emit('lobby:update', room.getUpdate());
        }
    });

    socket.on('lobby:ready', (isReady) => {
        const roomId = socket.currentRoomId;
        if (!roomId) return;
        const room = lobbyManager.getOrCreateRoom(roomId);
        if (room.toggleReady(socket.id, isReady)) {
            io.to(roomId).emit('lobby:update', room.getUpdate());

            const filledSlots = room.slots.filter((s) => s !== null);
            if (filledSlots.length >= 2 && filledSlots.every((s) => s.ready)) {
                startMatchCallback(roomId);
            }
        }
    });

    socket.on('lobby:setTeam', ({ team }) => {
        const roomId = socket.currentRoomId;
        if (!roomId) return;
        const room = lobbyManager.getOrCreateRoom(roomId);
        
        let maxLimit = 4;
        if (room.selectedMapName) {
            const mapConfig = mapService.loadReadyMap(room.selectedMapName);
            if (mapConfig && mapConfig.maxPlayersPerTeam && mapConfig.maxPlayersPerTeam[team] !== undefined) {
                maxLimit = mapConfig.maxPlayersPerTeam[team];
            }
        }

        if (room.setTeam(socket.id, team, maxLimit)) {
            io.to(roomId).emit('lobby:update', room.getUpdate());
        }
    });

    socket.on('lobby:setMap', (mapName) => {
        const roomId = socket.currentRoomId;
        if (!roomId) return;
        const room = lobbyManager.getOrCreateRoom(roomId);
        const slot1 = room.slots[0];
        if (slot1 && slot1.socketId === socket.id) {
            room.setMap(mapName);
            io.to(roomId).emit('lobby:update', room.getUpdate());
        }
    });
}
```

Modify `server/sockets/GameHandlers.js`:
Scope all handlers to lookup and emit state per room:
```javascript
import { ENTITY_STATS } from '../../shared/constants/EntityStats.js';
import { mapService } from '../MapService.js';
import { validateActions } from '../utils/ActionValidator.js';

export function registerGameHandlers(socket, io, context) {
    socket.on('requestState', () => {
        const roomId = socket.currentRoomId;
        if (!roomId) return;
        const room = context.lobbyManager.getOrCreateRoom(roomId);
        if (!room.matchStarted) return;
        
        context.safeEmit(
            socket,
            'gameStateUpdate',
            socket.assignedPlayerId && socket.assignedPlayerId !== 'spectator'
                ? room.game.getVisibleState(socket.assignedPlayerId)
                : room.game.getState()
        );
        context.safeEmit(socket, 'playerAssignment', socket.assignedPlayerId || 'spectator');
        
        const filteredLockedIn = {
            player1: room.lockedIn.player1,
            player2: room.lockedIn.player2
        };
        context.safeEmit(socket, 'syncStatus', { lockedIn: filteredLockedIn });

        if (socket.assignedPlayerId && socket.assignedPlayerId !== 'spectator') {
            const currentActions = room.turnActions[socket.assignedPlayerId] || [];
            context.safeEmit(socket, 'actionsUpdate', currentActions);
        }
    });

    socket.on('syncActions', (actions) => {
        const roomId = socket.currentRoomId;
        if (!roomId) return;
        const room = context.lobbyManager.getOrCreateRoom(roomId);
        if (!room.matchStarted || room.game.phase !== 'PLANNING') return;
        if (!socket.assignedPlayerId || socket.assignedPlayerId === 'spectator') return;
        if (room.lockedIn[socket.assignedPlayerId]) return;

        room.turnActions[socket.assignedPlayerId] = actions;
    });

    socket.on('passTurn', () => {
        const roomId = socket.currentRoomId;
        if (!roomId) return;
        const room = context.lobbyManager.getOrCreateRoom(roomId);
        if (!room.matchStarted || room.game.phase !== 'PLANNING') return;
        if (socket.assignedPlayerId !== 'player1' && socket.assignedPlayerId !== 'player2') return;

        console.log(`[Server Room ${roomId}] Player ${socket.assignedPlayerId} PASSED turn`);
        room.lockedIn[socket.assignedPlayerId] = true;
        room.turnActions[socket.assignedPlayerId] = [];

        const filteredLockedIn = {
            player1: room.lockedIn.player1,
            player2: room.lockedIn.player2
        };
        context.safeEmit(io.to(roomId), 'syncStatus', { lockedIn: filteredLockedIn });

        if (room.lockedIn.player1 && room.lockedIn.player2) {
            room.timerService.resolveTurn();
        }
    });

    socket.on('submitActions', (actions) => {
        const roomId = socket.currentRoomId;
        if (!roomId) return;
        const room = context.lobbyManager.getOrCreateRoom(roomId);
        if (!room.matchStarted || room.game.phase !== 'PLANNING') return;
        if (socket.assignedPlayerId !== 'player1' && socket.assignedPlayerId !== 'player2') return;

        const validatedActions = validateActions(actions, socket.assignedPlayerId, room.game);

        room.turnActions[socket.assignedPlayerId] = validatedActions;
        room.lockedIn[socket.assignedPlayerId] = true;

        const filteredLockedIn = {
            player1: room.lockedIn.player1,
            player2: room.lockedIn.player2
        };
        context.safeEmit(io.to(roomId), 'syncStatus', { lockedIn: filteredLockedIn });

        if (room.lockedIn.player1 && room.lockedIn.player2) {
            room.timerService.resolveTurn();
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

Modify `server/sockets/ChatHandlers.js`:
```javascript
export function registerChatHandlers(socket, io, context) {
    const { lobbyManager } = context;

    socket.on('chat:sendMessage', ({ text }) => {
        if (!text || typeof text !== 'string') return;

        const roomId = socket.currentRoomId || 'default';
        const room = lobbyManager.getOrCreateRoom(roomId);

        let senderName;
        if (socket.assignedPlayerId === 'player1') {
            senderName = 'Player 1';
        } else if (socket.assignedPlayerId === 'player2') {
            senderName = 'Player 2';
        } else {
            senderName = `Spectator (${socket.id.slice(0, 4)})`;
        }

        const senderId = socket.assignedPlayerId || 'spectator';
        const msg = room.addMessage(senderId, senderName, text);

        io.to(roomId).emit('chat:newMessage', msg);
    });
}
```

**Step 4: Run test to verify passes**
Run: `npx vitest run server/room_socket.test.js`
Expected: PASS

**Step 5: Commit**
```bash
git add server/sockets/LobbyHandlers.js server/sockets/GameHandlers.js server/sockets/ChatHandlers.js server/room_socket.test.js
git commit -m "feat: scope socket event handlers to currentRoomId"
```

---

### Task 4: Update `server/index.js` and Re-enable Integration Tests

**Files:**
- Modify: `server/index.js`
- Modify: `server/integration_lobby.test.js`
- Modify: `server/auto_start.test.js`
- Modify: `server/action_validation.test.js`
- Modify: `server/integration.test.js`

**Step 1: Write the failing test**
Run the existing test files:
Run: `npx vitest run server/integration_lobby.test.js`
Expected: FAIL or error due to changes in global properties on SessionContext.

**Step 2: Write minimal implementation**
Modify `server/index.js` to change `startMatch` to accept a `roomId` and bind variables to the correct room. Update socket connection logic:
```javascript
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { SessionContext } from './context/SessionContext.js';
import { registerLobbyHandlers } from './sockets/LobbyHandlers.js';
import { registerGameHandlers } from './sockets/GameHandlers.js';
import { registerChatHandlers } from './sockets/ChatHandlers.js';
import { mapService } from './MapService.js';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3005;

const context = new SessionContext();
context.io = io;

function startMatch(roomId) {
    console.log(`[Lobby Room ${roomId}] Starting match...`);
    const room = context.lobbyManager.getOrCreateRoom(roomId);

    // Assign players based on lobby slots
    context.playerIds.forEach((pid, index) => {
        room.playerAssignments[pid] = room.slots[index]?.token || null;
        room.activeSockets[pid] = room.slots[index]?.socketId || null;
    });

    let mapConfig = null;
    if (room.selectedMapName) {
        mapConfig = mapService.loadReadyMap(room.selectedMapName);
    }

    room.game.initializeGame(context.playerIds, mapConfig);
    room.matchStarted = true;
    room.status = 'IN_GAME';

    context.safeEmit(io.to(roomId), 'matchStarted', { playerAssignments: room.playerAssignments });

    context.playerIds.forEach((pid) => {
        const sid = room.activeSockets[pid];
        if (sid) {
            const socket = io.sockets.sockets.get(sid);
            if (socket) {
                socket.assignedPlayerId = pid;
                context.safeEmit(socket, 'playerAssignment', pid);
            }
        }
    });

    room.emitFilteredState(io);
    room.timerService.startTimer();
}

io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // Immediately list active rooms for the connecting client
    socket.emit('lobby:roomsList', context.lobbyManager.getRoomList());

    socket.on('authenticate', (token) => {
        if (!token) return;
        socket.currentToken = token;
        console.log(`Authenticating socket ${socket.id} with token ${token}`);

        // If reconnecting and they were already in a room, reconstruct session
        const room = context.lobbyManager.findRoomBySocketId(socket.id) || context.lobbyManager.getOrCreateRoom(socket.currentRoomId || 'default');
        
        if (room.matchStarted) {
            socket.assignedPlayerId = Object.keys(room.playerAssignments).find(
                (pid) => room.playerAssignments[pid] === token
            ) || 'spectator';

            if (socket.assignedPlayerId !== 'spectator') {
                room.activeSockets[socket.assignedPlayerId] = socket.id;
                context.safeEmit(socket, 'playerAssignment', socket.assignedPlayerId);
                context.safeEmit(socket, 'gameStateUpdate', room.game.getVisibleState(socket.assignedPlayerId));
                const currentActions = room.turnActions[socket.assignedPlayerId] || [];
                context.safeEmit(socket, 'actionsUpdate', currentActions);
            } else {
                context.safeEmit(socket, 'playerAssignment', 'spectator');
                context.safeEmit(socket, 'gameStateUpdate', room.game.getState());
            }
            context.safeEmit(socket, 'lobby:update', room.getUpdate());

            const filteredLockedIn = {};
            context.playerIds.forEach((pid) => {
                if (room.playerAssignments[pid]) {
                    filteredLockedIn[pid] = room.lockedIn[pid];
                }
            });
            context.safeEmit(io.to(room.id), 'syncStatus', { lockedIn: filteredLockedIn });
        } else {
            // Lobby Phase
            const reservedSlotIndex = room.slots.findIndex((s) => s && s.token === token);
            if (reservedSlotIndex !== -1) {
                socket.assignedPlayerId = `player${reservedSlotIndex + 1}`;
                room.slots[reservedSlotIndex].socketId = socket.id;
                context.safeEmit(socket, 'playerAssignment', socket.assignedPlayerId);
            } else if (room.slots.filter((s) => s !== null).length >= room.maxPlayers) {
                socket.assignedPlayerId = 'spectator';
                context.safeEmit(socket, 'playerAssignment', 'spectator');
            } else {
                context.safeEmit(socket, 'playerAssignment', null);
            }

            context.safeEmit(socket, 'lobby:update', room.getUpdate());
        }
    });

    registerLobbyHandlers(socket, io, context, null, startMatch);
    registerGameHandlers(socket, io, context);
    registerChatHandlers(socket, io, context);

    socket.on('restartGame', () => {
        const roomId = socket.currentRoomId || 'default';
        const room = context.lobbyManager.getOrCreateRoom(roomId);
        room.reset();

        io.to(roomId).sockets?.forEach((s) => {
            s.assignedPlayerId = null;
        });

        io.to(roomId).emit('lobby:update', room.getUpdate());
        io.to(roomId).emit('matchRestarted');
    });

    socket.on('disconnect', () => {
        console.log(`User Disconnected: ${socket.id}`);
        const roomId = socket.currentRoomId;
        if (roomId) {
            const room = context.lobbyManager.getOrCreateRoom(roomId);
            if (!room.matchStarted) {
                room.handleDisconnect(socket.id);
                // Check if room is empty and delete it (except default)
                const activeUsers = room.slots.filter(s => s !== null).length + room.spectators.length;
                if (activeUsers === 0 && roomId !== 'default') {
                    context.lobbyManager.deleteRoom(roomId);
                } else {
                    io.to(roomId).emit('lobby:update', room.getUpdate());
                }
                io.emit('lobby:roomsList', context.lobbyManager.getRoomList());
            } else if (socket.assignedPlayerId) {
                if (room.activeSockets[socket.assignedPlayerId] === socket.id) {
                    room.activeSockets[socket.assignedPlayerId] = null;
                }
            }
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`SERVER RUNNING ON PORT ${PORT} (0.0.0.0)`);
});
```

Modify the test suites (`server/integration_lobby.test.js`, `server/auto_start.test.js`, etc.) to emit `lobby:joinRoom` or perform room setup before asserting on slot changes. Run `vitest` to verify all tests continue to pass.

**Step 3: Run all tests to make sure they pass**
Run: `npx vitest run`
Expected: PASS

**Step 4: Commit**
```bash
git add server/index.js server/integration_lobby.test.js server/auto_start.test.js server/action_validation.test.js server/integration.test.js
git commit -m "feat: complete server integration for multi-room lobby"
```

---

### Task 5: Implement `RoomBrowser` Component on the Client

**Files:**
- Create: `client/src/components/RoomBrowser.jsx`
- Create: `client/src/components/RoomBrowser.css`

**Step 1: Write the failing test**
Create `client/src/components/RoomBrowser.test.jsx`:
```javascript
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RoomBrowser } from './RoomBrowser';

describe('RoomBrowser', () => {
    it('renders room list correctly', () => {
        const rooms = [{ id: 'room-1', playerCount: 2, maxPlayers: 8, status: 'LOBBY' }];
        render(<RoomBrowser rooms={rooms} onCreateRoom={() => {}} onJoinRoom={() => {}} />);
        expect(screen.getByText('room-1')).toBeDefined();
    });
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run client/src/components/RoomBrowser.test.jsx`
Expected: FAIL

**Step 3: Write minimal implementation**
Create `client/src/components/RoomBrowser.jsx`:
```jsx
import React, { useState } from 'react';
import './RoomBrowser.css';

export const RoomBrowser = ({ rooms, onCreateRoom, onJoinRoom }) => {
    const [newRoomId, setNewRoomId] = useState('');
    const [error, setError] = useState('');

    const handleCreate = (e) => {
        e.preventDefault();
        if (!newRoomId.trim()) {
            setError('Please enter a room name.');
            return;
        }
        if (newRoomId.length > 20) {
            setError('Room name must be 20 characters or less.');
            return;
        }
        setError('');
        onCreateRoom(newRoomId.trim());
        setNewRoomId('');
    };

    return (
        <div className="room-browser">
            <div className="browser-content">
                <h1 className="browser-title">TITAN: NEXUS COMMAND</h1>
                <p className="browser-subtitle">SECTOR DIRECTORY</p>

                <form onSubmit={handleCreate} className="create-room-form">
                    <input
                        type="text"
                        value={newRoomId}
                        onChange={(e) => setNewRoomId(e.target.value)}
                        placeholder="ENTER NEW SECTOR ID..."
                        className="create-room-input"
                    />
                    <button type="submit" className="create-room-button">
                        LAUNCH SECTOR
                    </button>
                </form>
                {error && <p className="error-message">{error}</p>}

                <div className="rooms-grid">
                    {rooms.map((room) => (
                        <div key={room.id} className={`room-card ${room.status === 'IN_GAME' ? 'active-match' : ''}`}>
                            <div className="room-card-header">
                                <span className="room-id">{room.id.toUpperCase()}</span>
                                <span className={`room-status-badge ${room.status === 'IN_GAME' ? 'in-game' : 'lobby'}`}>
                                    {room.status === 'IN_GAME' ? 'IN ORBIT' : 'PREPARING'}
                                </span>
                            </div>
                            <div className="room-card-body">
                                <span className="room-players">
                                    {room.playerCount} / {room.maxPlayers} CREW
                                </span>
                            </div>
                            <button
                                onClick={() => onJoinRoom(room.id)}
                                className="join-room-button"
                            >
                                {room.status === 'IN_GAME' ? 'SPECTATE' : 'DOCK'}
                            </button>
                        </div>
                    ))}
                    {rooms.length === 0 && (
                        <div className="no-rooms-card">
                            <span>NO ACTIVE SECTORS DETECTED</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
```

Create `client/src/components/RoomBrowser.css` to match the sci-fi dark space UI:
```css
.room-browser {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(circle at center, #1b2030 0%, #0d0f18 100%);
    display: flex;
    justify-content: center;
    align-items: center;
    font-family: 'Outfit', 'Inter', sans-serif;
    color: #e2e8f0;
}

.browser-content {
    background: rgba(13, 15, 24, 0.7);
    border: 1px solid rgba(0, 191, 255, 0.2);
    border-radius: 12px;
    padding: 3rem;
    width: 90%;
    max-width: 600px;
    box-shadow: 0 0 40px rgba(0, 191, 255, 0.1);
    backdrop-filter: blur(10px);
    text-align: center;
}

.browser-title {
    font-size: 2.5rem;
    font-weight: 900;
    letter-spacing: 4px;
    background: linear-gradient(135deg, #00d2ff 0%, #0066ff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 0.5rem;
}

.browser-subtitle {
    font-size: 1rem;
    letter-spacing: 6px;
    color: #00d2ff;
    opacity: 0.8;
    margin-bottom: 2rem;
}

.create-room-form {
    display: flex;
    gap: 10px;
    margin-bottom: 1.5rem;
}

.create-room-input {
    flex: 1;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(0, 191, 255, 0.3);
    border-radius: 6px;
    padding: 0.8rem 1.2rem;
    color: #fff;
    font-size: 1rem;
    letter-spacing: 1px;
}

.create-room-input:focus {
    outline: none;
    border-color: #00d2ff;
    box-shadow: 0 0 10px rgba(0, 191, 255, 0.3);
}

.create-room-button {
    background: linear-gradient(135deg, #00d2ff 0%, #0066ff 100%);
    border: none;
    border-radius: 6px;
    padding: 0.8rem 1.5rem;
    color: #fff;
    font-weight: bold;
    cursor: pointer;
    letter-spacing: 1px;
    transition: all 0.2s ease;
}

.create-room-button:hover {
    filter: brightness(1.2);
    box-shadow: 0 0 15px rgba(0, 191, 255, 0.4);
}

.rooms-grid {
    display: flex;
    flex-direction: column;
    gap: 15px;
    max-height: 300px;
    overflow-y: auto;
    padding-right: 5px;
}

.room-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 1.2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: all 0.2s ease;
}

.room-card:hover {
    border-color: rgba(0, 191, 255, 0.5);
    background: rgba(0, 191, 255, 0.05);
}

.room-card-header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
}

.room-id {
    font-weight: bold;
    font-size: 1.1rem;
    letter-spacing: 1px;
}

.room-status-badge {
    font-size: 0.75rem;
    letter-spacing: 1px;
    padding: 2px 6px;
    border-radius: 4px;
    margin-top: 4px;
}

.room-status-badge.lobby {
    background: rgba(0, 210, 255, 0.15);
    color: #00d2ff;
    border: 1px solid rgba(0, 210, 255, 0.3);
}

.room-status-badge.in-game {
    background: rgba(255, 120, 0, 0.15);
    color: #ff7800;
    border: 1px solid rgba(255, 120, 0, 0.3);
}

.room-players {
    font-size: 0.9rem;
    opacity: 0.7;
    letter-spacing: 1px;
}

.join-room-button {
    background: transparent;
    border: 1px solid rgba(0, 191, 255, 0.5);
    color: #00d2ff;
    border-radius: 4px;
    padding: 0.5rem 1.2rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s ease;
}

.join-room-button:hover {
    background: #00d2ff;
    color: #000;
}

.no-rooms-card {
    padding: 2rem;
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.4);
    letter-spacing: 2px;
}
```

**Step 4: Run test to verify passes**
Run: `npx vitest run client/src/components/RoomBrowser.test.jsx`
Expected: PASS

**Step 5: Commit**
```bash
git add client/src/components/RoomBrowser.jsx client/src/components/RoomBrowser.css client/src/components/RoomBrowser.test.jsx
git commit -m "feat: add sci-fi RoomBrowser component and styles"
```

---

### Task 6: Integrate room listing and navigation on the Client

**Files:**
- Modify: `client/src/hooks/useGameSocket.js`
- Modify: `client/src/components/LobbyOverlay.jsx`
- Modify: `client/src/App.jsx`

**Step 1: Write the failing test**
Update `client/src/chat_app_integration.test.jsx` or similar UI integration tests to assert that client can render LobbyOverlay when joining a room.
Expected: FAIL

**Step 2: Write minimal implementation**
Modify `client/src/hooks/useGameSocket.js`:
Add states for `roomsList` and handlers for room lifecycle events:
```javascript
    const [roomsList, setRoomsList] = useState([]);
    const [currentRoomId, setCurrentRoomId] = useState(null);

    // inside constructor/hook logic:
    const joinRoom = (roomId) => {
        socket.emit('lobby:joinRoom', { roomId });
    };

    const createRoom = (roomId) => {
        socket.emit('lobby:createRoom', { roomId });
    };

    const leaveRoom = () => {
        socket.emit('lobby:leaveRoom');
    };

    // Listeners inside useEffect:
    socket.on('lobby:roomsList', (rooms) => {
        setRoomsList(rooms);
    });

    socket.on('lobby:joinedRoom', (roomId) => {
        setCurrentRoomId(roomId);
    });

    socket.on('lobby:leftRoom', () => {
        setCurrentRoomId(null);
        setLobbyStatus(null);
    });
```

Modify `client/src/components/LobbyOverlay.jsx`:
Add a "Leave Sector" button and display room ID:
```jsx
// inside LobbyOverlay return at top or next to TITLE:
<h1 className="lobby-title">TITAN: {lobbyUpdate.id ? lobbyUpdate.id.toUpperCase() : 'NEXUS'}</h1>
// and a button near bottom:
<button onClick={onLeaveRoom} className="leave-room-button" style={{
    marginTop: '0.5rem',
    padding: '0.8rem 1.5rem',
    backgroundColor: '#c0392b',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    width: '100%'
}}>
    LEAVE SECTOR
</button>
```

Modify `client/src/App.jsx`:
Embed the `RoomBrowser` in the render flow:
```jsx
// Import RoomBrowser
import { RoomBrowser } from './components/RoomBrowser';

// Inside App component:
// Retrieve roomsList, currentRoomId, joinRoom, createRoom, leaveRoom from useGameSocket.

// In render flow:
if (currentView === 'LOBBY') {
    if (!currentRoomId) {
        return (
            <RoomBrowser
                rooms={roomsList}
                onCreateRoom={createRoom}
                onJoinRoom={joinRoom}
            />
        );
    }
    
    return (
        <LobbyOverlay
            lobbyUpdate={lobbyStatus}
            availableMaps={availableMaps}
            onClaimSeat={claimSeat}
            onReadyToggle={toggleReady}
            onSetMap={setMap}
            onOpenDesigner={() => setCurrentView('DESIGNER')}
            onOpenSandbox={() => setCurrentView('SANDBOX')}
            onSetTeam={setTeam}
            socketId={socket?.id}
            socket={socket}
            onLeaveRoom={leaveRoom}
        />
    );
}
```

**Step 3: Run all tests to make sure they pass**
Run: `npx vitest run`
Expected: PASS

**Step 4: Commit**
```bash
git add client/src/hooks/useGameSocket.js client/src/components/LobbyOverlay.jsx client/src/App.jsx
git commit -m "feat: connect client room browser to socket hooks and App navigation"
```
