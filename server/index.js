import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameState } from '../shared/GameState.js';

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

// Initialize Server-authoritative Game State
const game = new GameState();
const playerIds = ['player1', 'player2'];
game.initializeGame(playerIds);

let playerAssignments = {
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

const TURN_DURATION = 30;
let timeRemaining = TURN_DURATION;
let timerTimeout = null;

function startTimer() {
    if (timerTimeout) {
        clearTimeout(timerTimeout);
        timerTimeout = null;
    }
    timeRemaining = TURN_DURATION;
    // console.log(`[Timer] Starting new turn timer: ${timeRemaining}s`);
    io.emit('timerUpdate', timeRemaining);

    timerTimeout = setTimeout(tick, 1000);
}

function tick() {
    timeRemaining--;
    // console.log(`[Timer] Tick: ${timeRemaining}`);
    io.emit('timerUpdate', timeRemaining);

    if (timeRemaining <= 0) {
        // console.log('[Timer] Time up! Auto-resolving turn...');
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
        const assignedId = Object.keys(playerAssignments).find(pid => playerAssignments[pid] === socket.id);
        if (assignedId) {
            socket.emit('gameStateUpdate', game.getVisibleState(assignedId, baseState));
        } else {
            // Spectators see everything
            socket.emit('gameStateUpdate', baseState);
        }
    });
}

async function resolveTurn() {
    if (timerTimeout) {
        clearTimeout(timerTimeout);
        timerTimeout = null;
    }

    console.log('--- Resolving Turn ---');

    const actionsMap = {
        player1: turnActions.player1 || [],
        player2: turnActions.player2 || []
    };

    let snapshots;
    try {
        snapshots = game.resolveTurn(actionsMap);
    } catch (err) {
        console.error('CRITICAL ERROR: resolveTurn failed:', err);
        // Fallback to avoid hanging
        snapshots = [{ type: 'FINAL', state: game.getState() }];
    }

    // Notify clients that resolution is starting
    io.emit('resolutionStatus', { active: true, totalRounds: snapshots.length });

    // Process snapshots with delays
    for (const snap of snapshots) {
        console.log(`[Resolution] Emitting snapshot type: ${snap.type}${snap.round ? ` (Round ${snap.round})` : ''}`);

        emitFilteredState(snap.state);

        if (snap.type === 'ROUND') {
            io.emit('resolutionRound', snap.round);
        }

        // Dynamic Delay: Sub-ticks are fast, phase/round transitions are slow
        const delay = (snap.type === 'ROUND_SUB') ? 60 : 2000;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Reset for next turn
    lockedIn.player1 = false;
    lockedIn.player2 = false;
    turnActions.player1 = [];
    turnActions.player2 = [];

    io.emit('syncStatus', { lockedIn });
    io.emit('resolutionStatus', { active: false });

    // Start timer for the next turn
    startTimer();
}

// Start first timer
startTimer();

io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // Assign Player Slot
    let assignedPlayerId = null;
    for (const pid of playerIds) {
        if (!playerAssignments[pid]) {
            playerAssignments[pid] = socket.id;
            assignedPlayerId = pid;
            break;
        }
    }

    if (assignedPlayerId) {
        console.log(`Assigned ${socket.id} to ${assignedPlayerId}`);
        socket.emit('playerAssignment', assignedPlayerId);
    } else {
        console.log(`${socket.id} joined as spectator`);
        socket.emit('playerAssignment', 'spectator');
    }

    // Send current state
    socket.emit('gameStateUpdate', assignedPlayerId ? game.getVisibleState(assignedPlayerId) : game.getState());
    // Also send sync status
    io.emit('syncStatus', { lockedIn });

    socket.on('requestState', () => {
        socket.emit('gameStateUpdate', assignedPlayerId ? game.getVisibleState(assignedPlayerId) : game.getState());
        socket.emit('syncStatus', { lockedIn });
    });

    socket.on('submitActions', (actions) => {
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
            const cost = GameState.COSTS[action.itemType] || 0;
            if (player.energy < (totalCost + cost)) {
                console.warn(`Action REJECTED: Player ${assignedPlayerId} insufficient energy for full combo`);
                continue;
            }

            totalCost += cost;
            validatedActions.push({ ...action, playerId: assignedPlayerId });
        }

        turnActions[assignedPlayerId] = validatedActions;
        lockedIn[assignedPlayerId] = true;

        io.emit('syncStatus', { lockedIn });

        // Check if both players are locked in
        if (lockedIn.player1 && lockedIn.player2) {
            console.log('Both players locked in. Triggering resolution early...');
            resolveTurn();
        }
    });

    // Add a 'passTurn' event for when they don't want to launch anything
    socket.on('passTurn', () => {
        if (!assignedPlayerId || assignedPlayerId === 'spectator') return;

        console.log(`${assignedPlayerId} passed turn`);
        turnActions[assignedPlayerId] = []; // Empty array for no actions
        lockedIn[assignedPlayerId] = true;

        io.emit('syncStatus', { lockedIn });

        if (lockedIn.player1 && lockedIn.player2) {
            console.log('Both players locked in (via Pass). Triggering resolution early...');
            resolveTurn();
        }
    });

    socket.on('restartGame', () => {
        game.initializeGame(playerIds);
        lockedIn.player1 = false;
        lockedIn.player2 = false;
        turnActions.player1 = null;
        turnActions.player2 = null;
        emitFilteredState();
        socket.emit('syncStatus', { lockedIn });
        startTimer();
    });

    socket.on('disconnect', () => {
        console.log(`User Disconnected: ${socket.id}`);
        if (assignedPlayerId && assignedPlayerId !== 'spectator') {
            playerAssignments[assignedPlayerId] = null;
            // Option: auto-pass for disconnected players or wait? 
            // For prototype, we'll just free the slot.
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`SERVER RUNNING ON PORT ${PORT} (0.0.0.0)`);
});
