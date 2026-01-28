import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameState } from './logic/GameState.js';

const app = express();
app.use(cors());

// Debug logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;

// Initialize Server-authoritative Game State
const game = new GameState();
game.initializeGame(['player1', 'player2']);

io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // Send current state to newly connected client
    console.log(`Sending initial state to ${socket.id}`);
    socket.emit('gameStateUpdate', game.getState());

    socket.on('requestState', () => {
        console.log(`State requested by ${socket.id}`);
        socket.emit('gameStateUpdate', game.getState());
    });

    socket.on('submitAction', (action) => {
        console.log(`Action received from ${socket.id}:`, action);
        // In Phase 2/3, we'll queue actions. For now, let's resolve immediately 
        // to verify communication.
        game.resolveTurn([action]);
        io.emit('gameStateUpdate', game.getState());
    });

    socket.on('restartGame', () => {
        game.initializeGame(['player1', 'player2']);
        io.emit('gameStateUpdate', game.getState());
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`SERVER RUNNING ON PORT ${PORT} (0.0.0.0)`);
});
