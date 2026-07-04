import { LobbyRoom } from './LobbyRoom.js';

export class LobbyManager {
    constructor(context = null) {
        this.context = context;
        this.rooms = new Map();
        // Create a default room for the prototype
        this.getOrCreateRoom('default');
    }

    getOrCreateRoom(roomId) {
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new LobbyRoom(roomId, 2, this.context));
        }
        return this.rooms.get(roomId);
    }

    getRoomList() {
        return Array.from(this.rooms.values()).map(room => room.getMetadata());
    }

    createRoom(roomId, maxPlayers = 2) {
        if (this.rooms.has(roomId)) return null;
        const newRoom = new LobbyRoom(roomId, maxPlayers, this.context);
        this.rooms.set(roomId, newRoom);
        return newRoom;
    }

    deleteRoom(roomId) {
        const room = this.rooms.get(roomId);
        if (room) {
            if (room.timerService) room.timerService.stop();
            this.rooms.delete(roomId);
            return true;
        }
        return false;
    }

    findRoomBySocketId(socketId) {
        for (const room of this.rooms.values()) {
            const hasSocket = room.slots.some(s => s && s.socketId === socketId) || room.spectators.includes(socketId);
            if (hasSocket) return room;
        }
        return null;
    }

    handleSocketDisconnect(socketId) {
        for (const room of this.rooms.values()) {
            room.handleDisconnect(socketId);
        }
    }
}

