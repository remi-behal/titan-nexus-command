import { describe, it, expect, vi } from 'vitest';
import { registerLobbyHandlers } from './sockets/LobbyHandlers.js';
import { registerGameHandlers } from './sockets/GameHandlers.js';
import { registerChatHandlers } from './sockets/ChatHandlers.js';

describe('Socket Room Routing & Validation', () => {
    // Helper to setup mock socket, io, context
    function setupMocks() {
        const events = {};
        const roomsJoined = new Set();
        const roomsLeft = new Set();

        const mockSocket = {
            id: 'socket-1',
            currentToken: 'token-1',
            currentRoomId: null,
            assignedPlayerId: null,
            join: vi.fn((roomId) => {
                mockSocket.currentRoomId = roomId;
                roomsJoined.add(roomId);
            }),
            leave: vi.fn((roomId) => {
                mockSocket.currentRoomId = null;
                roomsLeft.add(roomId);
            }),
            on: vi.fn((event, cb) => {
                events[event] = cb;
            }),
            emit: vi.fn()
        };

        const mockIoEmit = vi.fn();
        const mockRoomEmit = vi.fn();
        const mockIo = {
            emit: mockIoEmit,
            to: vi.fn((roomId) => ({
                emit: mockRoomEmit
            }))
        };

        const mockRoom = {
            id: 'room-1',
            slots: [null, null],
            spectators: [],
            matchStarted: false,
            game: {
                phase: 'PLANNING',
                players: { player1: {}, player2: {} },
                entities: [],
                getState: vi.fn(() => ({ phase: 'PLANNING' })),
                getVisibleState: vi.fn(() => ({ phase: 'PLANNING', visible: true }))
            },
            lockedIn: { player1: false, player2: false },
            turnActions: { player1: [], player2: [] },
            timerService: {
                resolveTurn: vi.fn(),
                startTimer: vi.fn(),
                stop: vi.fn()
            },
            claimSeat: vi.fn(() => ({ success: true })),
            toggleReady: vi.fn(() => true),
            setTeam: vi.fn(() => true),
            setMap: vi.fn(),
            getUpdate: vi.fn(() => ({ id: 'room-1', slots: [] })),
            handleDisconnect: vi.fn((sid) => {
                mockRoom.spectators = mockRoom.spectators.filter(s => s !== sid);
            }),
            addMessage: vi.fn(() => ({ id: 'msg-1', text: 'hello' }))
        };

        const mockLobbyManager = {
            rooms: new Map([['room-1', mockRoom]]),
            getRoomList: vi.fn(() => [{ id: 'room-1' }]),
            createRoom: vi.fn((id, max) => {
                if (id === 'room-exists') return null;
                const newRoom = { ...mockRoom, id, slots: new Array(max).fill(null) };
                mockLobbyManager.rooms.set(id, newRoom);
                return newRoom;
            }),
            getOrCreateRoom: vi.fn((id) => {
                if (!mockLobbyManager.rooms.has(id)) {
                    mockLobbyManager.rooms.set(id, { ...mockRoom, id });
                }
                return mockLobbyManager.rooms.get(id);
            }),
            deleteRoom: vi.fn((id) => {
                mockLobbyManager.rooms.delete(id);
                return true;
            })
        };

        const mockContext = {
            lobbyManager: mockLobbyManager,
            safeEmit: vi.fn((emitter, event, data) => emitter.emit(event, data))
        };

        return {
            events,
            roomsJoined,
            roomsLeft,
            mockSocket,
            mockIo,
            mockIoEmit,
            mockRoomEmit,
            mockRoom,
            mockLobbyManager,
            mockContext
        };
    }

    describe('Lobby Handlers Routing', () => {
        it('should require currentRoomId for lobby:claimSeat', () => {
            const { mockSocket, mockIo, mockContext, mockRoom, mockLobbyManager } = setupMocks();
            
            // Set currentRoomId and trigger
            const socket = { currentRoomId: 'room-1', currentToken: 'token-1', id: 'socket-1' };
            const mockIo2 = { to: vi.fn(() => ({ emit: vi.fn() })) };
            const mockContext2 = { lobbyManager: mockLobbyManager, safeEmit: vi.fn() };
            
            // Re-bind events to the new socket
            const newEvents = {};
            socket.on = (e, cb) => { newEvents[e] = cb; };
            registerLobbyHandlers(socket, mockIo2, mockContext2, {}, () => {});

            newEvents['lobby:claimSeat'](0);
            expect(mockRoom.claimSeat).toHaveBeenCalledWith(0, 'token-1', 'socket-1');
        });

        it('should handle lobby:listRooms', () => {
            const { mockSocket, mockIo, mockContext } = setupMocks();
            const events = {};
            mockSocket.on = (e, cb) => { events[e] = cb; };
            registerLobbyHandlers(mockSocket, mockIo, mockContext, {}, () => {});

            events['lobby:listRooms']();
            expect(mockSocket.emit).toHaveBeenCalledWith('lobby:roomsList', [{ id: 'room-1' }]);
        });

        it('should handle lobby:createRoom successfully', () => {
            const { mockSocket, mockIo, mockContext, mockLobbyManager, mockIoEmit } = setupMocks();
            const events = {};
            mockSocket.on = (e, cb) => { events[e] = cb; };
            registerLobbyHandlers(mockSocket, mockIo, mockContext, {}, () => {});

            events['lobby:createRoom']('new-room');
            expect(mockLobbyManager.createRoom).toHaveBeenCalledWith('new-room', 2);
            expect(mockSocket.join).toHaveBeenCalledWith('new-room');
            expect(mockSocket.currentRoomId).toBe('new-room');
            expect(mockSocket.emit).toHaveBeenCalledWith('lobby:joinedRoom', 'new-room');
            expect(mockIoEmit).toHaveBeenCalledWith('lobby:roomsList', expect.any(Array));
        });

        it('should error on lobby:createRoom if room exists', () => {
            const { mockSocket, mockIo, mockContext } = setupMocks();
            const events = {};
            mockSocket.on = (e, cb) => { events[e] = cb; };
            registerLobbyHandlers(mockSocket, mockIo, mockContext, {}, () => {});

            events['lobby:createRoom']('room-exists');
            expect(mockSocket.emit).toHaveBeenCalledWith('lobby:createError', 'Room already exists');
        });

        it('should handle lobby:joinRoom', () => {
            const { mockSocket, mockIo, mockContext, mockLobbyManager, mockIoEmit } = setupMocks();
            const events = {};
            mockSocket.on = (e, cb) => { events[e] = cb; };
            registerLobbyHandlers(mockSocket, mockIo, mockContext, {}, () => {});

            events['lobby:joinRoom']('room-1');
            expect(mockSocket.join).toHaveBeenCalledWith('room-1');
            expect(mockSocket.currentRoomId).toBe('room-1');
            expect(mockLobbyManager.rooms.get('room-1').spectators).toContain('socket-1');
            expect(mockSocket.emit).toHaveBeenCalledWith('lobby:joinedRoom', 'room-1');
            expect(mockIoEmit).toHaveBeenCalledWith('lobby:roomsList', expect.any(Array));
        });

        it('should handle lobby:leaveRoom and delete room if empty', () => {
            const { mockSocket, mockIo, mockContext, mockLobbyManager } = setupMocks();
            const events = {};
            mockSocket.on = (e, cb) => { events[e] = cb; };
            registerLobbyHandlers(mockSocket, mockIo, mockContext, {}, () => {});

            mockSocket.currentRoomId = 'room-1';
            events['lobby:leaveRoom']();

            expect(mockSocket.leave).toHaveBeenCalledWith('room-1');
            expect(mockSocket.currentRoomId).toBeNull();
            expect(mockSocket.emit).toHaveBeenCalledWith('lobby:leftRoom');
            expect(mockLobbyManager.deleteRoom).toHaveBeenCalledWith('room-1');
        });
    });

    describe('Game Handlers Routing', () => {
        it('should require currentRoomId for requestState', () => {
            const { mockSocket, mockIo, mockContext, mockRoom } = setupMocks();
            const events = {};
            mockSocket.on = (e, cb) => { events[e] = cb; };
            registerGameHandlers(mockSocket, mockIo, mockContext, {});

            // Without currentRoomId
            events['requestState']();
            expect(mockRoom.game.getState).not.toHaveBeenCalled();

            // With currentRoomId but not matchStarted
            mockSocket.currentRoomId = 'room-1';
            events['requestState']();
            expect(mockRoom.game.getState).not.toHaveBeenCalled();

            // With matchStarted
            mockRoom.matchStarted = true;
            events['requestState']();
            expect(mockRoom.game.getState).toHaveBeenCalled();
        });

        it('should route submitActions and check room.game', () => {
            const { mockSocket, mockIo, mockContext, mockRoom } = setupMocks();
            const events = {};
            mockSocket.on = (e, cb) => { events[e] = cb; };
            registerGameHandlers(mockSocket, mockIo, mockContext, {});

            mockSocket.currentRoomId = 'room-1';
            mockSocket.assignedPlayerId = 'player1';
            mockRoom.matchStarted = true;

            events['submitActions']([{ type: 'move' }]);
            expect(mockRoom.turnActions.player1).toBeDefined();
            expect(mockRoom.lockedIn.player1).toBe(true);
        });
    });

    describe('Chat Handlers Routing', () => {
        it('should route chat:sendMessage to specific room only', () => {
            const { mockSocket, mockIo, mockContext, mockRoom, mockRoomEmit } = setupMocks();
            const events = {};
            mockSocket.on = (e, cb) => { events[e] = cb; };
            registerChatHandlers(mockSocket, mockIo, mockContext);

            mockSocket.currentRoomId = 'room-1';
            mockSocket.assignedPlayerId = 'player1';

            events['chat:sendMessage']({ text: 'Hello Room!' });
            expect(mockRoom.addMessage).toHaveBeenCalledWith('player1', 'Player 1', 'Hello Room!');
            expect(mockIo.to).toHaveBeenCalledWith('room-1');
            expect(mockRoomEmit).toHaveBeenCalledWith('chat:newMessage', expect.any(Object));
        });
    });
});
