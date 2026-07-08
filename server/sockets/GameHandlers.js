import { ENTITY_STATS } from '../../shared/constants/EntityStats.js';
import { mapService } from '../MapService.js';
import { validateActions } from '../utils/ActionValidator.js';

export function registerGameHandlers(socket, io, context, timerService) {
    const { lobbyManager } = context;

    socket.on('requestState', () => {
        const roomId = socket.currentRoomId;
        if (!roomId) return;
        const room = lobbyManager.rooms.get(roomId);
        if (!room) return;
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
        const room = lobbyManager.rooms.get(roomId);
        if (!room) return;
        if (!room.matchStarted || room.game.phase !== 'PLANNING') return;
        if (!socket.assignedPlayerId || socket.assignedPlayerId === 'spectator') return;
        if (room.lockedIn[socket.assignedPlayerId]) return;

        room.turnActions[socket.assignedPlayerId] = actions;
    });

    socket.on('passTurn', () => {
        const roomId = socket.currentRoomId;
        if (!roomId) return;
        const room = lobbyManager.rooms.get(roomId);
        if (!room) return;
        if (!room.matchStarted || room.game.phase !== 'PLANNING') return;
        if (socket.assignedPlayerId !== 'player1' && socket.assignedPlayerId !== 'player2') return;

        console.log(`[Server] Player ${socket.assignedPlayerId} PASSED turn`);
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
        const room = lobbyManager.rooms.get(roomId);
        if (!room) return;
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

    socket.on('map:save', (payload) => {
        try {
            if (!payload || typeof payload !== 'object') {
                throw new Error('Invalid request payload');
            }
            const { name, data } = payload;
            const fileName = mapService.saveMap(name, data);
            socket.emit('map:saveSuccess', fileName);

            // Broadcast updated map list to all clients
            const readyMaps = mapService.listReadyMaps().map((n) => ({
                id: n,
                name: n.replace(/_/g, ' '),
                isCustom: false
            }));
            const customMaps = mapService.listMaps().map((n) => ({
                id: n,
                name: n.replace(/_/g, ' '),
                isCustom: true
            }));
            
            const roomId = socket.currentRoomId;
            if (roomId) {
                io.to(roomId).emit('room:mapsUpdate', [...readyMaps, ...customMaps]);
            } else {
                io.emit('room:mapsUpdate', [...readyMaps, ...customMaps]);
            }
        } catch (err) {
            socket.emit('map:saveError', err.message);
        }
    });

    socket.on('map:list', () => {
        const maps = mapService.listMaps();
        socket.emit('map:listUpdate', maps);
    });

    socket.on('room:listMaps', () => {
        const readyMaps = mapService.listReadyMaps().map((n) => ({
            id: n,
            name: n.replace(/_/g, ' '),
            isCustom: false
        }));
        const customMaps = mapService.listMaps().map((n) => ({
            id: n,
            name: n.replace(/_/g, ' '),
            isCustom: true
        }));
        socket.emit('room:mapsUpdate', [...readyMaps, ...customMaps]);
    });

    socket.on('map:delete', (mapName) => {
        try {
            const success = mapService.deleteMap(mapName);
            if (success) {
                socket.emit('map:deleteSuccess', mapName);

                // Broadcast updated map list to all clients
                const readyMaps = mapService.listReadyMaps().map((n) => ({
                    id: n,
                    name: n.replace(/_/g, ' '),
                    isCustom: false
                }));
                const customMaps = mapService.listMaps().map((n) => ({
                    id: n,
                    name: n.replace(/_/g, ' '),
                    isCustom: true
                }));
                
                const roomId = socket.currentRoomId;
                if (roomId) {
                    io.to(roomId).emit('room:mapsUpdate', [...readyMaps, ...customMaps]);
                } else {
                    io.emit('room:mapsUpdate', [...readyMaps, ...customMaps]);
                }
            } else {
                socket.emit('map:deleteError', 'Map not found');
            }
        } catch (err) {
            socket.emit('map:deleteError', err.message);
        }
    });
}
