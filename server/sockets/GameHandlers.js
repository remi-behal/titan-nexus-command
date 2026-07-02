import { ENTITY_STATS } from '../../shared/constants/EntityStats.js';
import { mapService } from '../MapService.js';
import { validateActions } from '../utils/ActionValidator.js';

export function registerGameHandlers(socket, io, context, timerService) {
    const { game, lockedIn, turnActions } = context;

    socket.on('requestState', () => {
        if (!context.matchStarted) return;
        context.safeEmit(
            socket,
            'gameStateUpdate',
            socket.assignedPlayerId && socket.assignedPlayerId !== 'spectator'
                ? game.getVisibleState(socket.assignedPlayerId)
                : game.getState()
        );
        context.safeEmit(socket, 'playerAssignment', socket.assignedPlayerId || 'spectator');
        const filteredLockedIn = {
            player1: lockedIn.player1,
            player2: lockedIn.player2
        };
        context.safeEmit(socket, 'syncStatus', { lockedIn: filteredLockedIn });
    });

    socket.on('syncActions', (actions) => {
        if (!context.matchStarted || game.phase !== 'PLANNING') return;
        if (!socket.assignedPlayerId || socket.assignedPlayerId === 'spectator') return;
        if (lockedIn[socket.assignedPlayerId]) return;

        turnActions[socket.assignedPlayerId] = actions;
    });

    socket.on('passTurn', () => {
        if (!context.matchStarted || game.phase !== 'PLANNING') return;
        if (socket.assignedPlayerId !== 'player1' && socket.assignedPlayerId !== 'player2') return;

        console.log(`[Server] Player ${socket.assignedPlayerId} PASSED turn`);
        lockedIn[socket.assignedPlayerId] = true;
        turnActions[socket.assignedPlayerId] = [];

        const filteredLockedIn = {
            player1: lockedIn.player1,
            player2: lockedIn.player2
        };
        context.safeEmit(io, 'syncStatus', { lockedIn: filteredLockedIn });

        if (lockedIn.player1 && lockedIn.player2) {
            timerService.resolveTurn();
        }
    });

    socket.on('submitActions', (actions) => {
        if (!context.matchStarted || game.phase !== 'PLANNING') return;
        if (socket.assignedPlayerId !== 'player1' && socket.assignedPlayerId !== 'player2') return;

        const validatedActions = validateActions(actions, socket.assignedPlayerId, game);

        turnActions[socket.assignedPlayerId] = validatedActions;
        lockedIn[socket.assignedPlayerId] = true;

        const filteredLockedIn = {
            player1: lockedIn.player1,
            player2: lockedIn.player2
        };
        context.safeEmit(io, 'syncStatus', { lockedIn: filteredLockedIn });

        if (lockedIn.player1 && lockedIn.player2) {
            timerService.resolveTurn();
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
