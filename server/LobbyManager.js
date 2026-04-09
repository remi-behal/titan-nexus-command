import { LobbyRoom } from './LobbyRoom.js';

export class LobbyManager {
    constructor() {
        this.rooms = new Map();
        // Create a default room for the prototype
        this.getOrCreateRoom('default');
    }

    getOrCreateRoom(roomId) {
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new LobbyRoom(roomId));
        }
        return this.rooms.get(roomId);
    }

    handleSocketDisconnect(socketId) {
        for (const room of this.rooms.values()) {
            room.handleDisconnect(socketId);
        }
    }
}
