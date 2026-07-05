import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export const socket = io('/', {
    transports: ['polling', 'websocket'],
    autoConnect: true
});

const SESSION_TOKEN_KEY = 'titan_nexus_session_token';
const getSessionToken = () => {
    let token = localStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) {
        token = self.crypto.randomUUID();
        localStorage.setItem(SESSION_TOKEN_KEY, token);
    }
    return token;
};

export function useGameSocket() {
    const [playerState, setPlayerState] = useState(null);
    const turnRef = useRef(1);
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [myPlayerId, setMyPlayerId] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [syncStatus, setSyncStatus] = useState({ lockedIn: { player1: false, player2: false } });
    const [lastError, setLastError] = useState(null);
    const [availableMaps, setAvailableMaps] = useState([]);
    const [committedActions, setCommittedActions] = useState([]);
    const [timeRemaining, setTimeRemaining] = useState(30);
    const [isResolving, setIsResolving] = useState(false);
    const [lobbyStatus, setLobbyStatus] = useState(null);
    const [matchStarted, setMatchStarted] = useState(false);
    const [roomsList, setRoomsList] = useState([]);
    const [currentRoomId, setCurrentRoomId] = useState(null);
    const currentRoomIdRef = useRef(null);
    useEffect(() => {
        currentRoomIdRef.current = currentRoomId;
    }, [currentRoomId]);

    const isLocked = syncStatus?.lockedIn?.[myPlayerId] || false;
    const isResolvingPhase = playerState?.phase === 'RESOLVING';
    const isResolvingUI = isResolving || isResolvingPhase;

    const handleSendMessage = (text) => {
        socket.emit('chat:sendMessage', { text });
    };

    const handleToggleChat = () => {
        setIsChatOpen((prev) => !prev);
        setUnreadCount(0);
    };

    const handleExecuteTurn = () => {
        if (committedActions.length > 0) {
            socket.emit('submitActions', committedActions);
        } else {
            socket.emit('passTurn');
        }
    };

    const handleClearActions = () => {
        setCommittedActions([]);
    };

    const handleRestart = () => {
        socket.emit('restartGame');
        setCommittedActions([]);
        setMatchStarted(false);
    };

    const handleClaimSeat = (index, playerName) => {
        socket.emit('lobby:claimSeat', { slotIndex: index, playerName });
    };

    const handleReadyToggle = (isReady) => {
        socket.emit('lobby:ready', isReady);
    };

    const handleSetMap = (mapName) => {
        socket.emit('lobby:setMap', mapName);
    };

    const handleSetTeam = (team) => {
        socket.emit('lobby:setTeam', { team });
    };

    const handleMapSave = (mapData) => {
        const name = prompt('Enter a name for your map:');
        if (name) {
            socket.emit('map:save', { name, data: mapData });
        }
    };

    const handleMapDelete = (mapName) => {
        socket.emit('map:delete', mapName);
    };

    const joinRoom = (roomId) => {
        socket.emit('lobby:joinRoom', roomId);
    };

    const createRoom = (roomId) => {
        socket.emit('lobby:createRoom', roomId);
    };

    const leaveRoom = () => {
        socket.emit('lobby:leaveRoom');
    };

    useEffect(() => {
        const onConnect = () => {
            setIsConnected(true);
            const token = getSessionToken();
            const playerName = localStorage.getItem('titan_nexus_player_name') || `Pilot_${Math.floor(Math.random() * 9000 + 1000)}`;
            socket.emit('authenticate', { token, playerName, roomId: currentRoomIdRef.current });
        };

        const onDisconnect = () => {
            setIsConnected(false);
        };

        const onUpdate = (newState) => {
            setPlayerState(newState);
            setMatchStarted(true);

            if (newState.turn > turnRef.current) {
                setCommittedActions([]);
                turnRef.current = newState.turn;
            }
        };

        const onAssignment = (assignedId) => {
            setMyPlayerId(assignedId);
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('autoStart') === '1' && !assignedId) {
                socket.emit('lobby:autoJoin', { force: true });
            }
        };

        const onSyncStatus = (status) => {
            setSyncStatus(status);
        };

        const onTimerUpdate = (timeLeft) => {
            setTimeRemaining(timeLeft);
        };

        const onLobbyUpdate = (update) => {
            setLobbyStatus(update);
            if (update.status === 'IN_GAME') {
                setMatchStarted(true);
            }
        };

        const onMatchStarted = () => {
            setMatchStarted(true);
            const token = getSessionToken();
            const playerName = localStorage.getItem('titan_nexus_player_name') || `Pilot_${Math.floor(Math.random() * 9000 + 1000)}`;
            socket.emit('authenticate', { token, playerName, roomId: currentRoomIdRef.current });
            socket.emit('requestState');
        };

        const onMapsUpdate = (maps) => {
            setAvailableMaps(maps);
        };

        const onRoomsList = (rooms) => {
            setRoomsList(rooms || []);
        };

        const onJoinedRoom = (roomId) => {
            setCurrentRoomId(roomId);
        };

        const onLeftRoom = () => {
            setCurrentRoomId(null);
        };

        const onError = (err) => {
            setIsConnected(false);
            setLastError(err.message || JSON.stringify(err));
        };

        const onLobbyError = (err) => {
            setLastError(err.message || JSON.stringify(err));
        };

        const onResolutionStatus = (status) => {
            setIsResolving(status.active);
            if (status.active) {
                setCommittedActions([]);
            }
        };

        const onMatchRestarted = () => {
            setMatchStarted(false);
            const token = getSessionToken();
            const playerName = localStorage.getItem('titan_nexus_player_name') || `Pilot_${Math.floor(Math.random() * 9000 + 1000)}`;
            socket.emit('authenticate', { token, playerName, roomId: currentRoomIdRef.current });
        };

        const onChatHistory = (history) => {
            setChatMessages(history);
        };

        const onChatNewMessage = (msg) => {
            setChatMessages((prev) => {
                if (prev.some((m) => m.id === msg.id)) return prev;
                return [...prev, msg];
            });
            setIsChatOpen((open) => {
                if (!open) {
                    setUnreadCount((count) => count + 1);
                    try {
                        if (typeof window !== 'undefined' && window.zzfx) {
                            window.zzfx(...[0.1, 0, 800, 0.05, 0.05, 0.05, 0, 1, 0.1]);
                        }
                    } catch (e) {
                        console.error('Audio playback failed', e);
                    }
                }
                return open;
            });
        };

        const onActionsUpdate = (actions) => {
            setCommittedActions(actions);
        };

        const onSaveSuccess = (fileName) => {
            alert(`Map successfully saved: ${fileName}`);
        };

        const onSaveError = (err) => {
            setLastError(err);
            alert(`Failed to save map: ${err}`);
        };

        const onDeleteSuccess = (mapName) => {
            alert(`Map successfully deleted: ${mapName}`);
        };

        const onDeleteError = (err) => {
            setLastError(err);
            alert(`Failed to delete map: ${err}`);
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('gameStateUpdate', onUpdate);
        socket.on('playerAssignment', onAssignment);
        socket.on('syncStatus', onSyncStatus);
        socket.on('timerUpdate', onTimerUpdate);
        socket.on('resolutionStatus', onResolutionStatus);
        socket.on('matchRestarted', onMatchRestarted);
        socket.on('lobby:update', onLobbyUpdate);
        socket.on('matchStarted', onMatchStarted);
        socket.on('room:mapsUpdate', onMapsUpdate);
        socket.on('lobby:roomsList', onRoomsList);
        socket.on('lobby:joinedRoom', onJoinedRoom);
        socket.on('lobby:leftRoom', onLeftRoom);
        socket.on('connect_error', onError);
        socket.on('lobby:error', onLobbyError);
        socket.on('chat:history', onChatHistory);
        socket.on('chat:newMessage', onChatNewMessage);
        socket.on('actionsUpdate', onActionsUpdate);
        socket.on('map:saveSuccess', onSaveSuccess);
        socket.on('map:saveError', onSaveError);
        socket.on('map:deleteSuccess', onDeleteSuccess);
        socket.on('map:deleteError', onDeleteError);

        if (socket.connected) onConnect();

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('gameStateUpdate', onUpdate);
            socket.off('playerAssignment', onAssignment);
            socket.off('syncStatus', onSyncStatus);
            socket.off('timerUpdate', onTimerUpdate);
            socket.off('resolutionStatus', onResolutionStatus);
            socket.off('matchRestarted', onMatchRestarted);
            socket.off('lobby:update', onLobbyUpdate);
            socket.off('matchStarted', onMatchStarted);
            socket.off('room:mapsUpdate', onMapsUpdate);
            socket.off('lobby:roomsList', onRoomsList);
            socket.off('lobby:joinedRoom', onJoinedRoom);
            socket.off('lobby:leftRoom', onLeftRoom);
            socket.off('connect_error', onError);
            socket.off('lobby:error', onLobbyError);
            socket.off('chat:history', onChatHistory);
            socket.off('chat:newMessage', onChatNewMessage);
            socket.off('actionsUpdate', onActionsUpdate);
            socket.off('map:saveSuccess', onSaveSuccess);
            socket.off('map:saveError', onSaveError);
            socket.off('map:deleteSuccess', onDeleteSuccess);
            socket.off('map:deleteError', onDeleteError);
        };
    }, []);

    useEffect(() => {
        if (!isLocked && !isResolvingUI && committedActions.length >= 0) {
            socket.emit('syncActions', committedActions);
        }
    }, [committedActions, isLocked, isResolvingUI]);

    return {
        socket,
        isConnected,
        myPlayerId,
        playerState,
        lobbyStatus,
        matchStarted,
        syncStatus,
        timeRemaining,
        isResolving: isResolvingUI,
        isLocked,
        chatMessages,
        isChatOpen,
        unreadCount,
        availableMaps,
        lastError,
        committedActions,
        roomsList,
        currentRoomId,
        joinRoom,
        createRoom,
        leaveRoom,
        setCommittedActions,
        setLastError,
        setMatchStarted,
        setIsChatOpen,
        setUnreadCount,
        handleSendMessage,
        handleToggleChat,
        handleExecuteTurn,
        handleClearActions,
        handleRestart,
        handleClaimSeat,
        handleReadyToggle,
        handleSetMap,
        handleSetTeam,
        handleMapSave,
        handleMapDelete
    };
}
