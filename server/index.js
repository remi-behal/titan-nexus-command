import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameState } from '../shared/GameState.js';
import { ENTITY_STATS } from '../shared/constants/EntityStats.js';

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

// Initialize Server-authoritative Game State
const game = new GameState();
const playerIds = ['player1', 'player2'];
game.initializeGame(playerIds);

let playerAssignments = {
    'player1': null,
    'player2': null
};

// Maps playerId -> current socketId
let activeSockets = {
    'player1': null,
    'player2': null
};

let turnActions = {
    'player1': null,
    'player2': null
};

let lockedIn = {
    'player1': false,
    'player2': false
};

const TURN_DURATION = parseInt(process.env.TURN_DURATION) || 30;
let timeRemaining = TURN_DURATION;
let timerTimeout = null;

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
    console.log(`[Timer] Tick: ${timeRemaining} (Phase: ${game.phase})`);
    safeEmit(io, 'timerUpdate', timeRemaining);

    if (timeRemaining <= 0) {
        console.log('[Timer] Time up! Condition met.');
        resolveTurn();
    } else {
        timerTimeout = setTimeout(tick, 1000);
    }
}

/**
 * Helper to emit the game state to all players, 
 * correctly filtered by their individual Fog of War.
 */
function emitFilteredState(state = null) {
    const baseState = state || game.getState();

    io.sockets.sockets.forEach(socket => {
        // Find if this socket is one of the active player sockets
        const playerId = Object.keys(activeSockets).find(pid => activeSockets[pid] === socket.id);

        if (playerId) {
            safeEmit(socket, 'gameStateUpdate', game.getVisibleState(playerId, baseState));
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

        // 1. All action processing now happens in GameState.js
        timeRemaining = TURN_DURATION; // DEFENSIVE: Reset timer value immediately

        let snapshots;
        try {
            snapshots = game.resolveTurn(actionsMap);
        } catch (err) {
            console.error('CRITICAL ERROR: GameState.resolveTurn failed:', err);
            // Fallback to avoid hanging
            snapshots = [{ type: 'FINAL', state: game.getState() }];
        }

        // Notify clients that resolution is starting
        safeEmit(io, 'syncStatus', { lockedIn });
        safeEmit(io, 'resolutionStatus', { active: true, totalRounds: snapshots.length });

        // Process snapshots with delays
        for (const snap of snapshots) {
            emitFilteredState(snap.state);

            if (snap.type === 'ROUND_START' || snap.type === 'ROUND') {
                safeEmit(io, 'resolutionRound', snap.round);
            }

            // Dynamic Delay: Sub-ticks are fast, phase/round transitions are slow
            const delay = (snap.type === 'ROUND_SUB') ? 60 : 2000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }

    } catch (err) {
        console.error('CRITICAL ERROR during snapshot processing:', err);
    } finally {
        console.log('[Server] Finalizing turn resolution and unlocking UI...');

        // 1. Reset server-side action buffers for the NEXT turn
        lockedIn.player1 = false;
        lockedIn.player2 = false;
        turnActions.player1 = [];
        turnActions.player2 = [];

        // 2. Reset phase back to PLANNING
        game.phase = 'PLANNING';

        // 3. BROADCAST the transition
        emitFilteredState();
        safeEmit(io, 'syncStatus', { lockedIn });
        safeEmit(io, 'resolutionStatus', { active: false });

        // 4. Restart the timer
        startTimer();

        console.log('--- Resolution Complete ---');
    }
}

// Start first timer
startTimer();

io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);
    let assignedPlayerId = null;

    socket.on('authenticate', (token) => {
        if (!token) return;
        console.log(`Authenticating socket ${socket.id} with token ${token}`);

        // 1. Check if this token is already assigned to a player
        assignedPlayerId = Object.keys(playerAssignments).find(pid => playerAssignments[pid] === token);

        // 2. If not assigned, try to assign to a free slot
        if (!assignedPlayerId) {
            for (const pid of playerIds) {
                if (!playerAssignments[pid]) {
                    playerAssignments[pid] = token;
                    assignedPlayerId = pid;
                    break;
                }
            }
        }

        // 3. Update active socket mapping
        if (assignedPlayerId && assignedPlayerId !== 'spectator') {
            activeSockets[assignedPlayerId] = socket.id;
            console.log(`Assigned ${assignedPlayerId} to socket ${socket.id} (Token: ${token})`);
            safeEmit(socket, 'playerAssignment', assignedPlayerId);
        } else {
            console.log(`${socket.id} joined as spectator`);
            safeEmit(socket, 'playerAssignment', 'spectator');
        }

        // 4. Send initial state and sync status
        safeEmit(socket, 'gameStateUpdate', assignedPlayerId && assignedPlayerId !== 'spectator' ?
            game.getVisibleState(assignedPlayerId) : game.getState());
        safeEmit(io, 'syncStatus', { lockedIn });
    });

    socket.on('requestState', () => {
        safeEmit(socket, 'gameStateUpdate', assignedPlayerId && assignedPlayerId !== 'spectator' ?
            game.getVisibleState(assignedPlayerId) : game.getState());
        safeEmit(socket, 'syncStatus', { lockedIn });
    });

    socket.on('syncActions', (actions) => {
        if (game.phase !== 'PLANNING') return;
        if (!assignedPlayerId || assignedPlayerId === 'spectator') return;

        // RACE CONDITION FIX: If the player has already SUBMITTED, don't let 
        // trailing 'sync' packets overwrite the final action list.
        if (lockedIn[assignedPlayerId]) {
            console.log(`[Server] Ignored sync from ${assignedPlayerId} (Already Locked)`);
            return;
        }

        console.log(`Syncing actions from ${assignedPlayerId}:`, actions.length);

        const validatedActions = [];
        let totalCost = 0;
        const player = game.players[assignedPlayerId];

        for (const action of actions) {
            const sourceEntity = game.entities.find(e => e.id === action.sourceId);
            if (!sourceEntity || sourceEntity.owner !== assignedPlayerId) continue;

            const cost = ENTITY_STATS[action.itemType]?.cost || 0;
            if (player.energy < (totalCost + cost)) continue;

            totalCost += cost;
            validatedActions.push({ ...action, playerId: assignedPlayerId });
        }

        turnActions[assignedPlayerId] = validatedActions;
        // Note: No lockedIn = true here
    });

    socket.on('submitActions', (actions) => {
        if (game.phase !== 'PLANNING') return;
        if (!assignedPlayerId || assignedPlayerId === 'spectator') return;

        console.log(`Actions received from ${assignedPlayerId}:`, actions);

        // Server-side Integrity Check
        const validatedActions = [];
        let totalCost = 0;
        const player = game.players[assignedPlayerId];

        for (const action of actions) {
            // 1. Ownership Guard
            const sourceEntity = game.entities.find(e => e.id === action.sourceId);
            if (!sourceEntity || sourceEntity.owner !== assignedPlayerId) {
                console.warn(`Action REJECTED: Player ${assignedPlayerId} unauthorized source ${action.sourceId}`);
                continue;
            }

            // 2. Continuous Energy Check
            const cost = ENTITY_STATS[action.itemType]?.cost || 0;
            if (player.energy < (totalCost + cost)) {
                console.warn(`Action REJECTED: Player ${assignedPlayerId} insufficient energy for full combo`);
                continue;
            }

            totalCost += cost;
            validatedActions.push({ ...action, playerId: assignedPlayerId });
        }

        turnActions[assignedPlayerId] = validatedActions;
        lockedIn[assignedPlayerId] = true;

        safeEmit(io, 'syncStatus', { lockedIn });

        // Check if both players are locked in
        if (lockedIn.player1 && lockedIn.player2) {
            console.log(`[Socket] Both players locked in (via Submit from ${assignedPlayerId}). Triggering resolution early...`);
            resolveTurn();
        }
    });

    // Add a 'passTurn' event for when they don't want to launch anything
    socket.on('passTurn', () => {
        if (game.phase !== 'PLANNING') return;
        if (!assignedPlayerId || assignedPlayerId === 'spectator') return;

        console.log(`${assignedPlayerId} passed turn`);
        turnActions[assignedPlayerId] = []; // Empty array for no actions
        lockedIn[assignedPlayerId] = true;

        safeEmit(io, 'syncStatus', { lockedIn });

        if (lockedIn.player1 && lockedIn.player2) {
            console.log(`[Socket] Both players locked in (via Pass from ${assignedPlayerId}). Triggering resolution early...`);
            resolveTurn();
        }
    });

    socket.on('restartGame', () => {
        game.initializeGame(playerIds);
        lockedIn.player1 = false;
        lockedIn.player2 = false;
        turnActions.player1 = null;
        turnActions.player2 = null;

        // Clear assignments on game restart to allow fresh testing
        playerAssignments.player1 = null;
        playerAssignments.player2 = null;
        activeSockets.player1 = null;
        activeSockets.player2 = null;

        emitFilteredState();
        safeEmit(io, 'syncStatus', { lockedIn });
        safeEmit(io, 'matchRestarted');
        startTimer();
    });

    socket.on('disconnect', () => {
        console.log(`User Disconnected: ${socket.id}`);
        if (assignedPlayerId && assignedPlayerId !== 'spectator') {
            // Only clear the active socket mapping, RETAIN the playerAssignment (token)
            if (activeSockets[assignedPlayerId] === socket.id) {
                activeSockets[assignedPlayerId] = null;
            }
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`SERVER RUNNING ON PORT ${PORT} (0.0.0.0)`);
});
