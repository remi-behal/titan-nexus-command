import { GameState } from '../../shared/GameState.js';
import { LobbyManager } from '../LobbyManager.js';

export class SessionContext {
    constructor() {
        this.game = new GameState();
        this.lobbyManager = new LobbyManager();
        this.playerIds = ['player1', 'player2'];
        this.playerAssignments = { player1: null, player2: null };
        this.activeSockets = { player1: null, player2: null };
        this.turnActions = { player1: null, player2: null };
        this.lockedIn = { player1: false, player2: false };
        this.matchStarted = false;
        this.SIMULATED_LATENCY = parseInt(process.env.SIMULATED_LATENCY) || 0;
        this.TURN_DURATION = parseInt(process.env.TURN_DURATION) || 30;
        this.io = null;
    }

    safeEmit(emitter, event, data) {
        if (this.SIMULATED_LATENCY > 0) {
            setTimeout(() => emitter.emit(event, data), this.SIMULATED_LATENCY);
        } else {
            emitter.emit(event, data);
        }
    }

    emitFilteredState(state = null) {
        if (!this.matchStarted) return;
        const baseState = state || this.game.getState();

        this.io.sockets.sockets.forEach((socket) => {
            if (socket.assignedPlayerId) {
                this.safeEmit(
                    socket,
                    'gameStateUpdate',
                    this.game.getVisibleState(socket.assignedPlayerId, baseState)
                );
            } else {
                this.safeEmit(socket, 'gameStateUpdate', baseState);
            }
        });
    }

    reset() {
        this.matchStarted = false;
        const room = this.lobbyManager.getOrCreateRoom('default');
        room.status = 'LOBBY';
        room.slots = new Array(room.maxPlayers).fill(null);
        this.playerAssignments = { player1: null, player2: null };
        this.activeSockets = { player1: null, player2: null };
        this.turnActions = { player1: null, player2: null };
        this.lockedIn = { player1: false, player2: false };
    }
}
