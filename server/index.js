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

const allowedOrigins = new Set([
    'https://titannexuscommand.rbtek.space',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
]);

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin) || process.env.NODE_ENV === 'test') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST']
};

const app = express();
app.use(cors(corsOptions));

// Debug logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: corsOptions,
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;

const context = new SessionContext();
context.io = io;
const timerService = new TimerService(context);

function startMatch(roomId = 'default') {
    console.log(`[Lobby] Starting match in room ${roomId}...`);
    const room = context.lobbyManager.getOrCreateRoom(roomId);

    const filledSlots = room.slots.filter(s => s !== null);
    const uniqueTeams = new Set(filledSlots.map(s => s.team));
    const isTest = process.env.NODE_ENV === 'test';
    if (filledSlots.length >= 2 && uniqueTeams.size < 2 && !isTest) {
        console.warn(`[Lobby] Cannot start match in room ${roomId}: all players are on the same team.`);
        room.emit(io, 'lobby:error', { message: 'Cannot start match: all players are on the same team.' });
        return;
    }

    const playerTeams = {};
    const playerNames = {};

    const roomPlayerIds = Array.from({ length: room.maxPlayers }, (_, i) => `player${i + 1}`);

    // Assign players based on lobby slots
    roomPlayerIds.forEach((pid, index) => {
        const slot = room.slots[index];
        room.playerAssignments[pid] = slot?.token || null;
        room.activeSockets[pid] = slot?.socketId || null;
        if (slot) {
            playerTeams[pid] = slot.team;
            playerNames[pid] = slot.playerName || `Player ${index + 1}`;
        }
    });

    // Load custom map if selected
    let mapConfig = null;
    if (room.selectedMapName) {
        mapConfig = mapService.loadReadyMap(room.selectedMapName) || mapService.loadMap(room.selectedMapName);
        if (mapConfig) {
            console.log(`[Server] Starting match with custom map: ${room.selectedMapName}`);
        } else {
            console.warn(
                `[Server] Failed to load custom map: ${room.selectedMapName}. Falling back to default.`
            );
        }
    }

    room.game.initializeGame(roomPlayerIds, mapConfig, playerTeams, playerNames);
    room.matchStarted = true;
    room.status = 'IN_GAME';

    // Keep context sync for legacy tests
    context.game = room.game;
    context.matchStarted = true;
    context.playerAssignments = room.playerAssignments;
    context.activeSockets = room.activeSockets;

    room.emit(io, 'matchStarted', { playerAssignments: room.playerAssignments });

    // Send individual assignments to each socket that was in a slot
    roomPlayerIds.forEach((pid) => {
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
    
    // Default to 'default' room on connection
    socket.currentRoomId = 'default';
    socket.join('default');
    
    // Immediately send the room list to the socket
    socket.emit('lobby:roomsList', context.lobbyManager.getRoomList());

    socket.on('authenticate', (authData) => {
        let token;
        let playerName;
        let roomId;
        if (authData && typeof authData === 'object') {
            token = authData.token;
            playerName = authData.playerName;
            roomId = authData.roomId;
        } else {
            token = authData;
        }
        if (!token) return;
        socket.currentToken = token;
        if (playerName) {
            socket.playerName = playerName;
        }
        console.log(`Authenticating socket ${socket.id} with token ${token} (room: ${roomId || 'none'})`);

        // Look up room using findRoomBySocketId or custom roomId or currentRoomId
        const targetRoomId = roomId || socket.currentRoomId || 'default';
        const room = context.lobbyManager.findRoomBySocketId(socket.id) ||
                     context.lobbyManager.getOrCreateRoom(targetRoomId);
        
        socket.currentRoomId = room.id;
        socket.join(room.id);
        roomId = room.id;

        if (room.matchStarted) {
            // Re-claim slot logic
            socket.assignedPlayerId =
                Object.keys(room.playerAssignments).find(
                    (pid) => room.playerAssignments[pid] === token
                ) || 'spectator';

            if (socket.assignedPlayerId !== 'spectator') {
                room.activeSockets[socket.assignedPlayerId] = socket.id;
                console.log(`Re-assigned ${socket.assignedPlayerId} to socket ${socket.id}`);
                context.safeEmit(socket, 'playerAssignment', socket.assignedPlayerId);
                context.safeEmit(
                    socket,
                    'gameStateUpdate',
                    room.game.getVisibleState(socket.assignedPlayerId)
                );
                const currentActions = room.turnActions[socket.assignedPlayerId] || [];
                context.safeEmit(socket, 'actionsUpdate', currentActions);
            } else {
                console.log(`${socket.id} joined match as spectator`);
                context.safeEmit(socket, 'playerAssignment', 'spectator');
                context.safeEmit(socket, 'gameStateUpdate', room.game.getState());
            }
            context.safeEmit(socket, 'lobby:update', room.getUpdate()); // Send lobby state on reconnect

            // Only send valid player lock status
            const filteredLockedIn = {};
            const roomPlayerIds = Array.from({ length: room.maxPlayers }, (_, i) => `player${i + 1}`);
            roomPlayerIds.forEach((pid) => {
                if (room.playerAssignments[pid]) {
                    filteredLockedIn[pid] = room.lockedIn[pid];
                }
            });
            context.safeEmit(io.to(roomId), 'syncStatus', { lockedIn: filteredLockedIn });
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
        const roomId = socket.currentRoomId || (context.lobbyManager.findRoomBySocketId(socket.id)?.id) || 'default';
        const room = context.lobbyManager.getOrCreateRoom(roomId);
        room.timerService.stop();
        room.reset();

        // Reset all sockets in the room
        io.sockets.sockets.forEach((s) => {
            if (s.currentRoomId === roomId) {
                s.assignedPlayerId = null;
            }
        });

        io.to(roomId).emit('lobby:update', room.getUpdate());
        io.to(roomId).emit('matchRestarted');
    });

    socket.on('disconnect', () => {
        console.log(`User Disconnected: ${socket.id}`);
        const roomId = socket.currentRoomId || (context.lobbyManager.findRoomBySocketId(socket.id)?.id) || 'default';
        const room = context.lobbyManager.rooms.get(roomId);
        if (room) {
            room.handleDisconnect(socket.id);
            if (socket.assignedPlayerId) {
                if (room.activeSockets[socket.assignedPlayerId] === socket.id) {
                    room.activeSockets[socket.assignedPlayerId] = null;
                }
            }
            const playerCount = room.slots.filter((s) => s !== null).length;
            const spectatorCount = room.spectators.length;
            if (playerCount === 0 && spectatorCount === 0) {
                context.lobbyManager.deleteRoom(roomId);
            } else {
                io.to(roomId).emit('lobby:update', room.getUpdate());
            }
        }
        io.emit('lobby:roomsList', context.lobbyManager.getRoomList());
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`SERVER RUNNING ON PORT ${PORT} (0.0.0.0)`);
});
