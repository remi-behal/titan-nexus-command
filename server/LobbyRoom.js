export class LobbyRoom {
    constructor(id, maxPlayers = 8) {
        this.id = id;
        this.maxPlayers = maxPlayers;
        this.slots = new Array(maxPlayers).fill(null);
        this.spectators = [];
        this.status = 'LOBBY'; // LOBBY, IN_GAME
        this.selectedMapName = null;
        this.chatHistory = [];
    }

    addMessage(senderId, senderName, text) {
        const message = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            senderId,
            senderName,
            text: text.slice(0, 200),
            timestamp: Date.now()
        };
        this.chatHistory.push(message);
        if (this.chatHistory.length > 50) {
            this.chatHistory.shift();
        }
        return message;
    }

    claimSeat(slotIndex, token, socketId) {
        if (slotIndex < 0 || slotIndex >= this.maxPlayers) {
            return { success: false, message: 'Invalid slot' };
        }

        if (this.slots[slotIndex]) {
            return { success: false, message: 'Slot already occupied' };
        }

        // Remove from existing slot if any
        this.slots = this.slots.map((slot) =>
            slot && (slot.token === token || slot.socketId === socketId) ? null : slot
        );

        const defaultTeam = slotIndex < 4 ? 'Team A' : 'Team B';
        this.slots[slotIndex] = { token, socketId, ready: false, team: defaultTeam };
        return { success: true };
    }

    setTeam(socketId, team, maxPlayersPerTeam = 4) {
        const slot = this.slots.find((s) => s && s.socketId === socketId);
        if (!slot) return false;

        const count = this.slots.filter((s) => s && s.team === team && s.socketId !== socketId).length;
        if (count >= maxPlayersPerTeam) {
            return false;
        }

        slot.team = team;
        return true;
    }


    toggleReady(socketId, isReady) {
        const slot = this.slots.find((s) => s && s.socketId === socketId);
        if (slot) {
            slot.ready = isReady;
            return true;
        }
        return false;
    }

    setMap(mapName) {
        this.selectedMapName = mapName;
    }

    handleDisconnect(socketId) {
        const slotIndex = this.slots.findIndex((s) => s && s.socketId === socketId);
        if (slotIndex !== -1) {
            this.slots[slotIndex] = null;
        }
        this.spectators = this.spectators.filter((id) => id !== socketId);
    }

    getUpdate() {
        return {
            id: this.id,
            slots: this.slots,
            maxPlayers: this.maxPlayers,
            status: this.status,
            selectedMapName: this.selectedMapName
        };
    }
}
