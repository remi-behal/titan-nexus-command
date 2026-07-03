export function registerChatHandlers(socket, io, context) {
    const { lobbyManager } = context;

    socket.on('authenticate', (token) => {
        if (!token) return;
        const roomId = socket.currentRoomId;
        if (!roomId) return;
        const room = lobbyManager.rooms.get(roomId);
        if (!room) return;
        socket.emit('chat:history', room.chatHistory || []);
    });

    socket.on('chat:sendMessage', ({ text }) => {
        if (!text || typeof text !== 'string') return;

        const roomId = socket.currentRoomId;
        if (!roomId) return;
        const room = lobbyManager.rooms.get(roomId);
        if (!room) return;

        let senderName;
        const slot = room.slots.find(
            (s) => s && (s.socketId === socket.id || s.token === socket.currentToken)
        );
        if (slot && slot.playerName) {
            senderName = slot.playerName;
        } else if (context.matchStarted && socket.assignedPlayerId && socket.assignedPlayerId !== 'spectator') {
            const player = context.game.players[socket.assignedPlayerId];
            senderName = player?.name || socket.assignedPlayerId.replace('player', 'Player ');
        } else {
            senderName = `Spectator (${socket.id.slice(0, 4)})`;
        }

        const senderId = socket.assignedPlayerId || 'spectator';
        const msg = room.addMessage(senderId, senderName, text);

        io.to(roomId).emit('chat:newMessage', msg);
    });
}
