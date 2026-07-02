export function registerChatHandlers(socket, io, context) {
    const { lobbyManager } = context;

    socket.on('authenticate', (token) => {
        if (!token) return;
        const room = lobbyManager.getOrCreateRoom('default');
        socket.emit('chat:history', room.chatHistory || []);
    });

    socket.on('chat:sendMessage', ({ text }) => {
        if (!text || typeof text !== 'string') return;

        const room = lobbyManager.getOrCreateRoom('default');

        let senderName;
        if (socket.assignedPlayerId === 'player1') {
            senderName = 'Player 1';
        } else if (socket.assignedPlayerId === 'player2') {
            senderName = 'Player 2';
        } else {
            senderName = `Spectator (${socket.id.slice(0, 4)})`;
        }

        const senderId = socket.assignedPlayerId || 'spectator';
        const msg = room.addMessage(senderId, senderName, text);

        io.emit('chat:newMessage', msg);
    });
}
