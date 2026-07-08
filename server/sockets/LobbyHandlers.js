import { mapService } from '../MapService.js';

export function registerLobbyHandlers(socket, io, context, timerService, startMatchCallback) {
    const { lobbyManager } = context;

    // Room List Management Handlers
    socket.on('lobby:listRooms', () => {
        socket.emit('lobby:roomsList', lobbyManager.getRoomList());
    });

    socket.on('lobby:createRoom', (roomId) => {
        const id = typeof roomId === 'object' ? roomId.roomId : roomId;
        const maxPlayers = typeof roomId === 'object' ? roomId.maxPlayers || 2 : 2;
        const room = lobbyManager.createRoom(id, maxPlayers);
        if (room) {
            socket.join(id);
            socket.currentRoomId = id;
            socket.emit('lobby:joinedRoom', id);
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
        socket.emit('lobby:joinedRoom', id);
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
        socket.emit('lobby:leftRoom');
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

        const name = options.playerName || `Pilot_${Math.floor(Math.random() * 9000 + 1000)}`;

        const res = room.claimSeat(slotIndex, socket.currentToken, socket.id, name);
        if (res.success) {
            socket.assignedPlayerId = `player${slotIndex + 1}`;
            context.safeEmit(socket, 'playerAssignment', socket.assignedPlayerId);
            room.toggleReady(socket.id, true);
            io.to(roomId).emit('lobby:update', room.getUpdate());

            const filledSlots = room.slots.filter((s) => s !== null);
            const allReady = filledSlots.every((s) => s.ready);
            const uniqueTeams = new Set(filledSlots.map((s) => s.team));
            const isTest = process.env.NODE_ENV === 'test';
            if (allReady && (filledSlots.length >= 2 || options.force) && (uniqueTeams.size >= 2 || options.force || isTest)) {
                startMatchCallback(roomId);
            }
        }
    });

    socket.on('lobby:claimSeat', (payload) => {
        const roomId = socket.currentRoomId;
        if (!roomId) return;
        const room = lobbyManager.rooms.get(roomId);
        if (!room) return;

        let slotIndex;
        let playerName;
        if (payload && typeof payload === 'object') {
            slotIndex = payload.slotIndex;
            playerName = payload.playerName;
        } else {
            slotIndex = payload;
        }

        const res = playerName !== undefined
            ? room.claimSeat(slotIndex, socket.currentToken, socket.id, playerName)
            : room.claimSeat(slotIndex, socket.currentToken, socket.id);
        if (res.success) {
            socket.assignedPlayerId = `player${slotIndex + 1}`;
            context.safeEmit(socket, 'playerAssignment', socket.assignedPlayerId);
            io.to(roomId).emit('lobby:update', room.getUpdate());
        } else {
            socket.emit('lobby:error', { message: res.message });
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
            const uniqueTeams = new Set(filledSlots.map((s) => s.team));
            const isTest = process.env.NODE_ENV === 'test';
            if (filledSlots.length >= 2 && filledSlots.every((s) => s.ready) && (uniqueTeams.size >= 2 || isTest)) {
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
            const mapConfig = mapService.loadReadyMap(mapName) || mapService.loadMap(mapName);
            const playerBasesCount = mapConfig?.playerBases?.length || null;
            room.setMap(mapName, playerBasesCount);
            io.to(roomId).emit('lobby:update', room.getUpdate());
            io.emit('lobby:roomsList', lobbyManager.getRoomList());
        }
    });

    socket.on('lobby:changeName', (newName) => {
        if (newName && typeof newName === 'string' && newName.trim()) {
            socket.playerName = newName.trim();
            const roomId = socket.currentRoomId;
            if (roomId) {
                const room = lobbyManager.rooms.get(roomId);
                if (room) {
                    const slotIndex = room.slots.findIndex(s => s && s.socketId === socket.id);
                    if (slotIndex !== -1) {
                        room.slots[slotIndex].playerName = socket.playerName;
                    }
                    io.to(roomId).emit('lobby:update', room.getUpdate());
                }
            }
        }
    });

    socket.on('lobby:adjustSlots', ({ action }) => {
        const roomId = socket.currentRoomId;
        if (!roomId) return;
        const room = lobbyManager.rooms.get(roomId);
        if (!room) return;

        const slot1 = room.slots[0];
        if (slot1 && slot1.socketId === socket.id) {
            if (room.adjustSlots(action)) {
                io.to(roomId).emit('lobby:update', room.getUpdate());
                io.emit('lobby:roomsList', lobbyManager.getRoomList());
            }
        } else {
            socket.emit('lobby:error', { message: 'Only room owner can adjust slots.' });
        }
    });
}

