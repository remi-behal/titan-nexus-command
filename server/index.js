import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameState } from '../shared/GameState.js';
import { ENTITY_STATS } from '../shared/constants/EntityStats.js';
import { LobbyManager } from './LobbyManager.js';
import { mapService } from './MapService.js';

const app = express();
app.use(cors());

// Debug logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;
const SIMULATED_LATENCY = parseInt(process.env.SIMULATED_LATENCY) || 0;

/**
 * Helper to emit events with simulated latency if configured.
 * This is used for testing network stability and lag compensation.
 */
function safeEmit(emitter, event, data) {
    if (SIMULATED_LATENCY > 0) {
        setTimeout(() => emitter.emit(event, data), SIMULATED_LATENCY);
    } else {
        emitter.emit(event, data);
    }
}

// Global Game + Lobby State
const game = new GameState();
const lobbyManager = new LobbyManager();
const playerIds = ['player1', 'player2'];

let playerAssignments = {
    player1: null,
    player2: null
};

let activeSockets = {
    player1: null,
    player2: null
};

let turnActions = {
    player1: null,
    player2: null
};

let lockedIn = {
    player1: false,
    player2: false
};

const TURN_DURATION = parseInt(process.env.TURN_DURATION) || 30;
const RESOLUTION_ROUND_DELAY = parseInt(process.env.RESOLUTION_ROUND_DELAY) || 2000;
const RESOLUTION_SUB_TICK_DELAY = parseInt(process.env.RESOLUTION_SUB_TICK_DELAY) || 60;

let timeRemaining = TURN_DURATION;
let timerTimeout = null;
let matchStarted = false;

function startTimer() {
    if (timerTimeout) {
        clearTimeout(timerTimeout);
        timerTimeout = null;
    }
    timeRemaining = TURN_DURATION;
    console.log(`[Timer] NEW TIMER START: ${timeRemaining}s`);
    safeEmit(io, 'timerUpdate', timeRemaining);

    timerTimeout = setTimeout(tick, 1000);
}

function tick() {
    timeRemaining--;
    safeEmit(io, 'timerUpdate', timeRemaining);

    if (timeRemaining <= 0) {
        console.log('[Timer] Time up!');
        resolveTurn();
    } else {
        timerTimeout = setTimeout(tick, 1000);
    }
}

function startMatch() {
    console.log('[Lobby] Starting match...');
    const room = lobbyManager.getOrCreateRoom('default');

    // Assign players based on lobby slots
    playerAssignments.player1 = room.slots[0]?.token || null;
    playerAssignments.player2 = room.slots[1]?.token || null;
    activeSockets.player1 = room.slots[0]?.socketId || null;
    activeSockets.player2 = room.slots[1]?.socketId || null;

    game.initializeGame(playerIds);
    matchStarted = true;
    room.status = 'IN_GAME';

    safeEmit(io, 'matchStarted', { playerAssignments });

    // Send individual assignments to each socket that was in a slot
    playerIds.forEach(pid => {
        const sid = activeSockets[pid];
        if (sid) {
            const socket = io.sockets.sockets.get(sid);
            if (socket) {
                socket.assignedPlayerId = pid;
                safeEmit(socket, 'playerAssignment', pid);
            }
        }
    });

    emitFilteredState();
    startTimer();
}

/**
 * Helper to emit the game state to all players.
 */
function emitFilteredState(state = null) {
    if (!matchStarted) return;
    const baseState = state || game.getState();

    io.sockets.sockets.forEach((socket) => {
        if (socket.assignedPlayerId) {
            safeEmit(socket, 'gameStateUpdate', game.getVisibleState(socket.assignedPlayerId, baseState));
        } else {
            // Spectators see everything
            safeEmit(socket, 'gameStateUpdate', baseState);
        }
    });
}

async function resolveTurn() {
    console.log(`[Server] resolveTurn called. Current Phase: ${game.phase}`);
    if (game.phase === 'RESOLVING') {
        console.warn('[Server] Blocked parallel turn resolution.');
        return;
    }
    game.phase = 'RESOLVING';

    try {
        if (timerTimeout) {
            clearTimeout(timerTimeout);
            timerTimeout = null;
        }

        const actionsMap = {
            player1: turnActions.player1 || [],
            player2: turnActions.player2 || []
        };

        console.log(`[Server] Resolving turn ${game.turn} with actions: P1=${actionsMap.player1.length}, P2=${actionsMap.player2.length}`);

        let snapshots;
        try {
            snapshots = game.resolveTurn(actionsMap);
        } catch (err) {
            console.error('CRITICAL ERROR: GameState.resolveTurn failed:', err);
            snapshots = [{ type: 'FINAL', state: game.getState() }];
        }

        safeEmit(io, 'syncStatus', { lockedIn });
        safeEmit(io, 'resolutionStatus', { active: true, totalRounds: snapshots.length });

        for (const snap of snapshots) {
            emitFilteredState(snap.state);

            if (snap.type === 'ROUND_START' || snap.type === 'ROUND') {
                safeEmit(io, 'resolutionRound', snap.round);
            }

            const delay = snap.type === 'ROUND_SUB' ? RESOLUTION_SUB_TICK_DELAY : RESOLUTION_ROUND_DELAY;
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    } catch (err) {
        console.error('CRITICAL ERROR during snapshot processing:', err);
    } finally {
        console.log('[Server] Finalizing turn resolution and unlocking UI...');

        lockedIn.player1 = false;
        lockedIn.player2 = false;
        turnActions.player1 = [];
        turnActions.player2 = [];
        game.phase = 'PLANNING';

        emitFilteredState();
        safeEmit(io, 'syncStatus', { lockedIn });
        safeEmit(io, 'resolutionStatus', { active: false });

        startTimer();
    }
}

// NOTE: We no longer call startTimer() at bottom-level. 
// It is called in startMatch().

io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    socket.on('authenticate', (token) => {
        if (!token) return;
        socket.currentToken = token;
        console.log(`Authenticating socket ${socket.id} with token ${token}`);

        const room = lobbyManager.getOrCreateRoom('default');

        if (matchStarted) {
            // Re-claim slot logic
            socket.assignedPlayerId = Object.keys(playerAssignments).find(
                (pid) => playerAssignments[pid] === token
            ) || 'spectator';

            if (socket.assignedPlayerId !== 'spectator') {
                activeSockets[socket.assignedPlayerId] = socket.id;
                console.log(`Re-assigned ${socket.assignedPlayerId} to socket ${socket.id}`);
                safeEmit(socket, 'playerAssignment', socket.assignedPlayerId);
                safeEmit(socket, 'gameStateUpdate', game.getVisibleState(socket.assignedPlayerId));
            } else {
                console.log(`${socket.id} joined match as spectator`);
                safeEmit(socket, 'playerAssignment', 'spectator');
                safeEmit(socket, 'gameStateUpdate', game.getState());
            }
            safeEmit(socket, 'lobby:update', room.getUpdate()); // Send lobby state on reconnect

            // Only send valid player lock status
            const filteredLockedIn = {
                player1: lockedIn.player1,
                player2: lockedIn.player2
            };
            safeEmit(io, 'syncStatus', { lockedIn: filteredLockedIn });
        } else {
            // Lobby Phase
            console.log(`Socket ${socket.id} in lobby`);

            // Check if this token already has a seat reserved
            const reservedSlotIndex = room.slots.findIndex(s => s && s.token === token);
            if (reservedSlotIndex !== -1) {
                socket.assignedPlayerId = `player${reservedSlotIndex + 1}`;
                room.slots[reservedSlotIndex].socketId = socket.id; // Update socket ID
                safeEmit(socket, 'playerAssignment', socket.assignedPlayerId);
            } else if (room.slots.filter(s => s !== null).length >= room.maxPlayers) {
                // If lobby is full and token is not found, they are a spectator
                socket.assignedPlayerId = 'spectator';
                safeEmit(socket, 'playerAssignment', 'spectator');
            } else {
                // Send null assignment if no seat claimed yet (legacy compat)
                safeEmit(socket, 'playerAssignment', null);
            }

            safeEmit(socket, 'lobby:update', room.getUpdate());
        }
    });

    socket.on('lobby:autoJoin', () => {
        const room = lobbyManager.getOrCreateRoom('default');
        console.log(`[Lobby] Auto-join requested by ${socket.id}`);

        // Find first available slot
        let slotIndex = room.slots.findIndex(s => s === null);
        if (slotIndex === -1) {
            console.warn(`[Lobby] Auto-join failed: Room full`);
            return;
        }

        const res = room.claimSeat(slotIndex, socket.currentToken, socket.id);
        if (res.success) {
            console.log(`[Lobby] Slot ${slotIndex} AUTO-CLAIMED by ${socket.id}`);
            socket.assignedPlayerId = `player${slotIndex + 1}`;
            safeEmit(socket, 'playerAssignment', socket.assignedPlayerId);
            room.toggleReady(socket.id, true);
            io.emit('lobby:update', room.getUpdate());

            // Auto-start if 2 players are ready
            const filledSlots = room.slots.filter(s => s !== null);
            if (filledSlots.length === 2 && filledSlots.every(s => s.ready)) {
                console.log(`[Lobby] Auto-starting match from autoJoin`);
                startMatch();
            }
        }
    });

    socket.on('lobby:claimSeat', (slotIndex) => {
        console.log(`[Lobby] Socket ${socket.id} attempting to claim seat ${slotIndex} (Token: ${socket.currentToken})`);
        const room = lobbyManager.getOrCreateRoom('default');
        const res = room.claimSeat(slotIndex, socket.currentToken, socket.id);
        if (res.success) {
            console.log(`[Lobby] Slot ${slotIndex} CLAIMED by ${socket.id}`);
            // Assign ID immediately for lobby phase (supports legacy tests)
            socket.assignedPlayerId = `player${slotIndex + 1}`;
            safeEmit(socket, 'playerAssignment', socket.assignedPlayerId);
            io.emit('lobby:update', room.getUpdate());
        } else {
            console.warn(`[Lobby] Claim seat failed for ${socket.id}: ${res.message}`);
        }
    });

    socket.on('lobby:ready', (isReady) => {
        const room = lobbyManager.getOrCreateRoom('default');
        if (room.toggleReady(socket.id, isReady)) {
            io.emit('lobby:update', room.getUpdate());

            // Auto-start if 2 players are ready
            const filledSlots = room.slots.filter(s => s !== null);
            if (filledSlots.length === 2 && filledSlots.every(s => s.ready)) {
                startMatch();
            }
        }
    });

    socket.on('requestState', () => {
        if (!matchStarted) return;
        safeEmit(
            socket,
            'gameStateUpdate',
            socket.assignedPlayerId && socket.assignedPlayerId !== 'spectator'
                ? game.getVisibleState(socket.assignedPlayerId)
                : game.getState()
        );
        const filteredLockedIn = {
            player1: lockedIn.player1,
            player2: lockedIn.player2
        };
        safeEmit(socket, 'syncStatus', { lockedIn: filteredLockedIn });
    });

    socket.on('syncActions', (actions) => {
        if (!matchStarted || game.phase !== 'PLANNING') return;
        if (!socket.assignedPlayerId || socket.assignedPlayerId === 'spectator') return;

        if (lockedIn[socket.assignedPlayerId]) return;

        // Validation logic omitted for brevity in prototype, reuse from original if needed
        turnActions[socket.assignedPlayerId] = actions;
    });

    socket.on('passTurn', () => {
        if (!matchStarted || game.phase !== 'PLANNING') return;
        if (socket.assignedPlayerId !== 'player1' && socket.assignedPlayerId !== 'player2') return;

        console.log(`[Server] Player ${socket.assignedPlayerId} PASSED turn`);
        lockedIn[socket.assignedPlayerId] = true;
        turnActions[socket.assignedPlayerId] = [];

        const filteredLockedIn = {
            player1: lockedIn.player1,
            player2: lockedIn.player2
        };
        safeEmit(io, 'syncStatus', { lockedIn: filteredLockedIn });

        if (lockedIn.player1 && lockedIn.player2) {
            resolveTurn();
        }
    });

    socket.on('submitActions', (actions) => {
        if (!matchStarted || game.phase !== 'PLANNING') {
            console.warn(`[Server] submitActions ignored: matchStarted=${matchStarted}, phase=${game.phase}`);
            return;
        }
        if (socket.assignedPlayerId !== 'player1' && socket.assignedPlayerId !== 'player2') {
            console.warn(`[Server] submitActions ignored: unauthorized assignedPlayerId=${socket.assignedPlayerId}`);
            return;
        }

        const validatedActions = [];
        let totalCost = 0;
        const player = game.players[socket.assignedPlayerId];

        for (const action of actions) {
            const sourceEntity = game.entities.find((e) => e.id === action.sourceId);
            if (!sourceEntity || sourceEntity.owner !== socket.assignedPlayerId) {
                console.warn(`[Server] Action REJECTED for ${socket.assignedPlayerId}: unauthorized source ${action.sourceId}`);
                continue;
            }

            const cost = ENTITY_STATS[action.itemType]?.cost || 0;
            if (player.energy < totalCost + cost) {
                console.warn(`[Server] Action REJECTED for ${socket.assignedPlayerId}: insufficient energy (has ${player.energy}, needs ${totalCost + cost})`);
                continue;
            }

            totalCost += cost;
            validatedActions.push({ ...action, playerId: socket.assignedPlayerId });
        }

        turnActions[socket.assignedPlayerId] = validatedActions;
        lockedIn[socket.assignedPlayerId] = true;

        const filteredLockedIn = {
            player1: lockedIn.player1,
            player2: lockedIn.player2
        };
        safeEmit(io, 'syncStatus', { lockedIn: filteredLockedIn });

        if (lockedIn.player1 && lockedIn.player2) {
            resolveTurn();
        }
    });

    socket.on('restartGame', () => {
        matchStarted = false;
        const room = lobbyManager.getOrCreateRoom('default');
        room.status = 'LOBBY';
        room.slots = new Array(room.maxPlayers).fill(null); // Full reset of slots

        // Reset all match tracking globals
        playerAssignments = { player1: null, player2: null };
        activeSockets = { player1: null, player2: null };
        turnActions = { player1: null, player2: null };
        lockedIn = { player1: false, player2: false };

        // Reset all sockets
        io.sockets.sockets.forEach(s => { s.assignedPlayerId = null; });

        io.emit('lobby:update', room.getUpdate());
        io.emit('matchRestarted');
    });

    socket.on('map:save', ({ name, data }) => {
        try {
            console.log(`[MapService] Saving map: ${name}`);
            const fileName = mapService.saveMap(name, data);
            socket.emit('map:saveSuccess', fileName);
        } catch (err) {
            console.error('[MapService] Failed to save map:', err);
            socket.emit('map:saveError', err.message);
        }
    });

    socket.on('map:list', () => {
        const maps = mapService.listMaps();
        socket.emit('map:listUpdate', maps);
    });

    socket.on('disconnect', () => {
        console.log(`User Disconnected: ${socket.id}`);
        if (!matchStarted) {
            lobbyManager.handleSocketDisconnect(socket.id);
            io.emit('lobby:update', lobbyManager.getOrCreateRoom('default').getUpdate());
        } else if (socket.assignedPlayerId) {
            if (activeSockets[socket.assignedPlayerId] === socket.id) {
                activeSockets[socket.assignedPlayerId] = null;
            }
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`SERVER RUNNING ON PORT ${PORT} (0.0.0.0)`);
});
