import { mapService } from '../MapService.js';

export function registerLobbyHandlers(socket, io, context, timerService, startMatchCallback) {
    const { lobbyManager } = context;

    socket.on('lobby:autoJoin', (options = {}) => {
        const room = lobbyManager.getOrCreateRoom('default');
        let slotIndex = room.slots.findIndex((s) => s === null);
        if (slotIndex === -1) return;

        const res = room.claimSeat(slotIndex, socket.currentToken, socket.id);
        if (res.success) {
            socket.assignedPlayerId = `player${slotIndex + 1}`;
            context.safeEmit(socket, 'playerAssignment', socket.assignedPlayerId);
            room.toggleReady(socket.id, true);
            io.emit('lobby:update', room.getUpdate());

            const filledSlots = room.slots.filter((s) => s !== null);
            const allReady = filledSlots.every((s) => s.ready);
            if (allReady && (filledSlots.length >= 2 || options.force)) {
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

            const filledSlots = room.slots.filter((s) => s !== null);
            if (filledSlots.length >= 2 && filledSlots.every((s) => s.ready)) {
                startMatchCallback();
            }
        }
    });

    socket.on('lobby:setTeam', ({ team }) => {
        const room = lobbyManager.getOrCreateRoom('default');
        
        let maxLimit = 4;
        if (room.selectedMapName) {
            const mapConfig = mapService.loadReadyMap(room.selectedMapName) || mapService.loadMap(room.selectedMapName);
            if (mapConfig && mapConfig.maxPlayersPerTeam && mapConfig.maxPlayersPerTeam[team] !== undefined) {
                maxLimit = mapConfig.maxPlayersPerTeam[team];
            }
        }

        if (room.setTeam(socket.id, team, maxLimit)) {
            io.emit('lobby:update', room.getUpdate());
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

