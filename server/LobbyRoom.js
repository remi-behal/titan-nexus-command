import { GameState } from '../shared/GameState.js';
import { TimerService } from './services/TimerService.js';

export class LobbyRoom {
    constructor(id, maxPlayers = 2, context = null) {
        this.id = id;
        this.maxPlayers = maxPlayers;
        this.context = context;
        this.slots = new Array(maxPlayers).fill(null);
        this.spectators = [];
        this.status = 'LOBBY'; // LOBBY, IN_GAME
        this.selectedMapName = null;
        this.chatHistory = [];

        // Game context properties scoped to room
        this.game = new GameState();
        this.timerService = new TimerService(this);
        this.playerAssignments = {};
        this.activeSockets = {};
        this.turnActions = {};
        this.lockedIn = {};
        
        this.matchStarted = false;
        
        // Populate standard assignment maps
        for (let i = 1; i <= maxPlayers; i++) {
            const pid = `player${i}`;
            this.playerAssignments[pid] = null;
            this.activeSockets[pid] = null;
            this.turnActions[pid] = null;
            this.lockedIn[pid] = false;
        }
    }

    getMetadata() {
        const playerCount = this.slots.filter(s => s !== null).length;
        return {
            id: this.id,
            playerCount,
            maxPlayers: this.maxPlayers,
            status: this.status
        };
    }

    emit(io, event, data) {
        if (this.context) {
            this.context.safeEmit(io.to(this.id), event, data);
        } else {
            io.to(this.id).emit(event, data);
        }
    }

    emitFilteredState(io, state = null) {
        if (!this.matchStarted) return;
        const baseState = state || this.game.getState();

        this.emit(io, 'gameStateUpdate', baseState); // Spectators fallback
        
        // Send player-specific updates
        for (let i = 1; i <= this.maxPlayers; i++) {
            const pid = `player${i}`;
            const sid = this.activeSockets[pid];
            if (sid) {
                const socket = io.sockets.sockets.get(sid);
                if (socket) {
                    this.context.safeEmit(
                        socket,
                        'gameStateUpdate',
                        this.game.getVisibleState(pid, baseState)
                    );
                }
            }
        }
    }

    reset() {
        this.matchStarted = false;
        this.status = 'LOBBY';
        this.slots = new Array(this.maxPlayers).fill(null);
        this.playerAssignments = {};
        this.activeSockets = {};
        this.turnActions = {};
        this.lockedIn = {};
        
        for (let i = 1; i <= this.maxPlayers; i++) {
            const pid = `player${i}`;
            this.playerAssignments[pid] = null;
            this.activeSockets[pid] = null;
            this.turnActions[pid] = null;
            this.lockedIn[pid] = false;
        }
        this.game = new GameState();
        if (this.timerService) this.timerService.stop();
        this.timerService = new TimerService(this);
    }

    adjustSlots(action) {
        if (action === 'add') {
            if (this.maxPlayers < 8) {
                this.maxPlayers++;
                this.slots.push(null);
                
                const pid = `player${this.maxPlayers}`;
                this.playerAssignments[pid] = null;
                this.activeSockets[pid] = null;
                this.turnActions[pid] = null;
                this.lockedIn[pid] = false;
                return true;
            }
        } else if (action === 'remove') {
            if (this.maxPlayers > 2) {
                if (this.slots[this.slots.length - 1] === null) {
                    const pid = `player${this.maxPlayers}`;
                    delete this.playerAssignments[pid];
                    delete this.activeSockets[pid];
                    delete this.turnActions[pid];
                    delete this.lockedIn[pid];
                    
                    this.slots.pop();
                    this.maxPlayers--;
                    return true;
                }
            }
        }
        return false;
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

    claimSeat(slotIndex, token, socketId, playerName) {
        if (slotIndex < 0 || slotIndex >= this.maxPlayers) {
            return { success: false, message: 'Invalid slot' };
        }

        if (this.slots[slotIndex]) {
            return { success: false, message: 'Slot already occupied' };
        }

        let trimmedName;
        if (playerName === undefined || playerName === null) {
            trimmedName = `Player ${slotIndex + 1}`;
        } else if (typeof playerName !== 'string' || !playerName.trim()) {
            return { success: false, message: 'Name cannot be empty!' };
        } else {
            trimmedName = playerName.trim();
        }

        if (trimmedName.length > 15) {
            return { success: false, message: 'Name must be 15 characters or less!' };
        }

        // Check if name is already taken by another player (using case-insensitive comparison)
        const nameTaken = this.slots.some(
            (slot) => slot && slot.token !== token && slot.playerName && slot.playerName.toLowerCase() === trimmedName.toLowerCase()
        );
        if (nameTaken) {
            return { success: false, message: 'Name is already taken!' };
        }

        // Remove from existing slot if any
        this.slots = this.slots.map((slot) =>
            slot && (slot.token === token || slot.socketId === socketId) ? null : slot
        );

        const defaultTeam = slotIndex < 4 ? 'Team A' : 'Team B';
        this.slots[slotIndex] = { token, socketId, ready: false, team: defaultTeam, playerName: trimmedName };
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

    setMap(mapName, playerBasesCount = null) {
        this.selectedMapName = mapName;
        if (playerBasesCount !== null && playerBasesCount >= 2 && playerBasesCount <= 8) {
            this.maxPlayers = playerBasesCount;
            const oldSlots = this.slots;
            this.slots = new Array(playerBasesCount).fill(null);
            for (let i = 0; i < Math.min(oldSlots.length, playerBasesCount); i++) {
                this.slots[i] = oldSlots[i];
            }
        }
    }

    handleDisconnect(socketId) {
        const slotIndex = this.slots.findIndex((s) => s && s.socketId === socketId);
        if (slotIndex !== -1) {
            this.slots[slotIndex] = null;
        }
        this.spectators = this.spectators.filter((id) => id !== socketId);
    }

    getUpdate() {
        const spectatorsWithNames = this.spectators.map(sid => {
            if (this.context && this.context.io) {
                const s = this.context.io.sockets.sockets.get(sid);
                if (s && s.playerName) {
                    return { id: sid, name: s.playerName };
                }
            }
            return { id: sid, name: `Spectator (${sid.substring(0, 5)})` };
        });

        return {
            id: this.id,
            slots: this.slots,
            maxPlayers: this.maxPlayers,
            status: this.status,
            selectedMapName: this.selectedMapName,
            spectators: spectatorsWithNames
        };
    }
}
