import { LobbyManager } from '../LobbyManager.js';

export class SessionContext {
    constructor() {
        this.lobbyManager = new LobbyManager(this);
        this.playerIds = Array.from({ length: 8 }, (_, i) => `player${i + 1}`);
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
}

