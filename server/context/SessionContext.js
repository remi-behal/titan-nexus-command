import { GameState } from '../../shared/GameState.js';
import { LobbyManager } from '../LobbyManager.js';

export class SessionContext {
    constructor() {
        this.game = new GameState();
        this.lobbyManager = new LobbyManager();
        this.playerIds = Array.from({ length: 8 }, (_, i) => `player${i + 1}`);
        this.playerAssignments = {};
        this.activeSockets = {};
        this.turnActions = {};
        this.lockedIn = {};
        
        this.playerIds.forEach((pid) => {
            this.playerAssignments[pid] = null;
            this.activeSockets[pid] = null;
            this.turnActions[pid] = null;
            this.lockedIn[pid] = false;
        });

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
        
        this.playerAssignments = {};
        this.activeSockets = {};
        this.turnActions = {};
        this.lockedIn = {};
        
        this.playerIds.forEach((pid) => {
            this.playerAssignments[pid] = null;
            this.activeSockets[pid] = null;
            this.turnActions[pid] = null;
            this.lockedIn[pid] = false;
        });
    }

}
