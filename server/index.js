import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { SessionContext } from './context/SessionContext.js';
import { TimerService } from './services/TimerService.js';
import { registerLobbyHandlers } from './sockets/LobbyHandlers.js';
import { registerGameHandlers } from './sockets/GameHandlers.js';
import { registerChatHandlers } from './sockets/ChatHandlers.js';
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

const context = new SessionContext();
context.io = io;
const timerService = new TimerService(context);

function startMatch() {
    console.log('[Lobby] Starting match...');
    const room = context.lobbyManager.getOrCreateRoom('default');

    // Assign players based on lobby slots
    context.playerIds.forEach((pid, index) => {
        context.playerAssignments[pid] = room.slots[index]?.token || null;
        context.activeSockets[pid] = room.slots[index]?.socketId || null;
    });

    // Load custom map if selected
    let mapConfig = null;
    if (room.selectedMapName) {
        mapConfig = mapService.loadReadyMap(room.selectedMapName);
        if (mapConfig) {
            console.log(`[Server] Starting match with custom map: ${room.selectedMapName}`);
        } else {
            console.warn(
                `[Server] Failed to load custom map: ${room.selectedMapName}. Falling back to default.`
            );
        }
    }

    context.game.initializeGame(context.playerIds, mapConfig);
    context.matchStarted = true;
    room.status = 'IN_GAME';

    context.safeEmit(io, 'matchStarted', { playerAssignments: context.playerAssignments });

    // Send individual assignments to each socket that was in a slot
    context.playerIds.forEach((pid) => {
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
        console.log(`Authenticating socket ${socket.id} with token ${token}`);

        const room = context.lobbyManager.getOrCreateRoom('default');

        if (context.matchStarted) {
            // Re-claim slot logic
            socket.assignedPlayerId =
                Object.keys(context.playerAssignments).find(
                    (pid) => context.playerAssignments[pid] === token
                ) || 'spectator';

            if (socket.assignedPlayerId !== 'spectator') {
                context.activeSockets[socket.assignedPlayerId] = socket.id;
                console.log(`Re-assigned ${socket.assignedPlayerId} to socket ${socket.id}`);
                context.safeEmit(socket, 'playerAssignment', socket.assignedPlayerId);
                context.safeEmit(
                    socket,
                    'gameStateUpdate',
                    context.game.getVisibleState(socket.assignedPlayerId)
                );
                const currentActions = context.turnActions[socket.assignedPlayerId] || [];
                context.safeEmit(socket, 'actionsUpdate', currentActions);
            } else {
                console.log(`${socket.id} joined match as spectator`);
                context.safeEmit(socket, 'playerAssignment', 'spectator');
                context.safeEmit(socket, 'gameStateUpdate', context.game.getState());
            }
            context.safeEmit(socket, 'lobby:update', room.getUpdate()); // Send lobby state on reconnect

            // Only send valid player lock status
            const filteredLockedIn = {};
            context.playerIds.forEach((pid) => {
                if (context.playerAssignments[pid]) {
                    filteredLockedIn[pid] = context.lockedIn[pid];
                }
            });
            context.safeEmit(io, 'syncStatus', { lockedIn: filteredLockedIn });
        } else {
            // Lobby Phase
            console.log(`Socket ${socket.id} in lobby`);

            // Check if this token already has a seat reserved
            const reservedSlotIndex = room.slots.findIndex((s) => s && s.token === token);
            if (reservedSlotIndex !== -1) {
                socket.assignedPlayerId = `player${reservedSlotIndex + 1}`;
                room.slots[reservedSlotIndex].socketId = socket.id; // Update socket ID
                context.safeEmit(socket, 'playerAssignment', socket.assignedPlayerId);
            } else if (room.slots.filter((s) => s !== null).length >= room.maxPlayers) {
                // If lobby is full and token is not found, they are a spectator
                socket.assignedPlayerId = 'spectator';
                context.safeEmit(socket, 'playerAssignment', 'spectator');
            } else {
                // Send null assignment if no seat claimed yet (legacy compat)
                context.safeEmit(socket, 'playerAssignment', null);
            }

            context.safeEmit(socket, 'lobby:update', room.getUpdate());
        }
    });

    registerLobbyHandlers(socket, io, context, timerService, startMatch);
    registerGameHandlers(socket, io, context, timerService);
    registerChatHandlers(socket, io, context);

    socket.on('restartGame', () => {
        timerService.stop();
        context.reset();

        // Reset all sockets
        io.sockets.sockets.forEach((s) => {
            s.assignedPlayerId = null;
        });

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
