import { mapService } from '../MapService.js';

export function registerLobbyHandlers(socket, io, context, timerService, startMatchCallback) {
    const { lobbyManager } = context;

    // Room List Management Handlers
    socket.on('lobby:listRooms', () => {
        socket.emit('lobby:roomsList', lobbyManager.getRoomList());
    });

    socket.on('lobby:createRoom', (roomId) => {
        const id = typeof roomId === 'object' ? roomId.roomId : roomId;
        const maxPlayers = typeof roomId === 'object' ? roomId.maxPlayers || 8 : 8;
        const room = lobbyManager.createRoom(id, maxPlayers);
        if (room) {
            socket.join(id);
            socket.currentRoomId = id;
            io.emit('lobby:roomsList', lobbyManager.getRoomList());
            io.to(id).emit('lobby:update', room.getUpdate());
        } else {
            socket.emit('lobby:createError', 'Room already exists');
        }
    });

    socket.on('lobby:joinRoom', (roomId) => {
        const id = typeof roomId === 'object' ? roomId.roomId : roomId;
        const room = lobbyManager.getOrCreateRoom(id);
        socket.join(id);
        socket.currentRoomId = id;
        if (!room.spectators.includes(socket.id)) {
            room.spectators.push(socket.id);
        }
        io.emit('lobby:roomsList', lobbyManager.getRoomList());
        io.to(id).emit('lobby:update', room.getUpdate());
    });

    socket.on('lobby:leaveRoom', () => {
        const id = socket.currentRoomId;
        if (!id) return;

        const room = lobbyManager.rooms.get(id);
        if (room) {
            room.handleDisconnect(socket.id);
            socket.leave(id);
            socket.currentRoomId = null;
            socket.assignedPlayerId = null;

            const playerCount = room.slots.filter((s) => s !== null).length;
            const spectatorCount = room.spectators.length;
            if (playerCount === 0 && spectatorCount === 0) {
                lobbyManager.deleteRoom(id);
            } else {
                io.to(id).emit('lobby:update', room.getUpdate());
            }
        }
        io.emit('lobby:roomsList', lobbyManager.getRoomList());
    });

    socket.on('disconnect', () => {
        const id = socket.currentRoomId;
        if (id) {
            const room = lobbyManager.rooms.get(id);
            if (room) {
                room.handleDisconnect(socket.id);
                const playerCount = room.slots.filter((s) => s !== null).length;
                const spectatorCount = room.spectators.length;
                if (playerCount === 0 && spectatorCount === 0) {
                    lobbyManager.deleteRoom(id);
                } else {
                    io.to(id).emit('lobby:update', room.getUpdate());
                }
            }
            io.emit('lobby:roomsList', lobbyManager.getRoomList());
        }
    });

    // Scoped Game/Lobby Interaction Handlers
    socket.on('lobby:autoJoin', (options = {}) => {
        const roomId = socket.currentRoomId;
        if (!roomId) return;
        const room = lobbyManager.rooms.get(roomId);
        if (!room) return;

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
        const room = lobbyManager.rooms.get(roomId);
        if (!room) return;

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
        const room = lobbyManager.rooms.get(roomId);
        if (!room) return;

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
        const room = lobbyManager.rooms.get(roomId);
        if (!room) return;
        
        let maxLimit = 4;
        if (room.selectedMapName) {
            const mapConfig = mapService.loadReadyMap(room.selectedMapName) || mapService.loadMap(room.selectedMapName);
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
        const room = lobbyManager.rooms.get(roomId);
        if (!room) return;

        const slot1 = room.slots[0];
        if (slot1 && slot1.socketId === socket.id) {
            room.setMap(mapName);
            io.to(roomId).emit('lobby:update', room.getUpdate());
        }
    });
}

