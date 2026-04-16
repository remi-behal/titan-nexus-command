import { useState, useEffect, useRef } from 'react';
import './App.css';
import { GameState } from '../../shared/GameState.js';
import { ENTITY_STATS, GLOBAL_STATS } from '../../shared/constants/EntityStats.js';
import GameBoard from './components/GameBoard';
import RadialMenu from './components/RadialMenu';
import { LobbyOverlay } from './components/LobbyOverlay';
import { io } from 'socket.io-client';

const socket = io('/', {
    transports: ['polling', 'websocket'],
    autoConnect: true
});

const MAX_PULL_DISTANCE = GLOBAL_STATS.MAX_PULL;

// Session Token Management
const SESSION_TOKEN_KEY = 'titan_nexus_session_token';
const getSessionToken = () => {
    let token = localStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) {
        token = self.crypto.randomUUID();
        localStorage.setItem(SESSION_TOKEN_KEY, token);
    }
    return token;
};

function App() {
    const [playerState, setPlayerState] = useState(null);
    const turnRef = useRef(1); // Track turn for stale closures in listeners
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [myPlayerId, setMyPlayerId] = useState(null);
    const [syncStatus, setSyncStatus] = useState({ lockedIn: { player1: false, player2: false } });
    const [lastError, setLastError] = useState(null);
    const [selectedHubId, setSelectedHubId] = useState(null);
    const [selectedItemType, setSelectedItemType] = useState('HUB');
    const [launchMode, setLaunchMode] = useState(false);
    const [isAiming, setIsAiming] = useState(false);
    const [committedActions, setCommittedActions] = useState([]);
    const [showDebugPreview, setShowDebugPreview] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState(30);
    const [isResolving, setIsResolving] = useState(false);

    // Lobby State
    const [lobbyStatus, setLobbyStatus] = useState(null);
    const [matchStarted, setMatchStarted] = useState(false);
    const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
    const ZOOM_LEVEL = 2; // Match GameBoard's zoom

    // Help RadialMenu track its hub
    const [hubScreenPos, setHubScreenPos] = useState(null);
    const gameBoardRef = useRef(null);

    const isResolvingPhase = playerState?.phase === 'RESOLVING';
    const isResolvingUI = isResolving || isResolvingPhase;
    const isLocked = syncStatus?.lockedIn?.[myPlayerId] || false;

    const handleAimStart = (overrideHubId) => {
        const targetHubId = overrideHubId || selectedHubId;
        if (!targetHubId) return;

        // Check if selected structure has fuel
        const selectedEntity = playerState?.entities?.find((e) => e.id === targetHubId);
        const pendingFuelSpent = committedActions.filter((a) => a.sourceId === targetHubId).length;
        const hasFuel = selectedEntity
            ? selectedEntity.fuel === undefined || selectedEntity.fuel - pendingFuelSpent > 0
            : false;

        if (launchMode && !isLocked && hasFuel) {
            setIsAiming(true);
        }
    };

    const handleAimEnd = (x, y) => {
        if (!isAiming) return;
        setIsAiming(false);

        const hub = playerState.entities.find((e) => e.id === selectedHubId);
        if (!hub) return;

        // Calculate Slingshot (Opposite of drag)
        // Use toroidal-aware vector subtraction so dragging across edges works correctly
        const { dx, dy } = GameState.getToroidalVector(
            hub.x,
            hub.y,
            x,
            y,
            playerState.map.width,
            playerState.map.height
        );
        let distance = Math.sqrt(dx * dx + dy * dy);

        // Clamp distance
        if (distance > MAX_PULL_DISTANCE) {
            distance = MAX_PULL_DISTANCE;
        }

        const angle = GameState.calculateLaunchAngle(dx, dy);

        const action = {
            playerId: myPlayerId,
            type: 'LAUNCH',
            itemType: selectedItemType,
            sourceId: hub.id,
            sourceX: hub.x,
            sourceY: hub.y,
            angle: angle,
            distance: distance
        };

        setCommittedActions((prev) => [...prev, action]);
        setLaunchMode(false);
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
        setLaunchMode(false);
    };

    const handleRestart = () => {
        socket.emit('restartGame');
        setCommittedActions([]);
        setSelectedHubId(null);
        setLaunchMode(false);
        setMatchStarted(false);
    };

    const handleClaimSeat = (index) => {
        socket.emit('lobby:claimSeat', index);
    };

    const handleReadyToggle = (isReady) => {
        socket.emit('lobby:ready', isReady);
    };

    useEffect(() => {
        console.log('Connecting to socket...');

        const onConnect = () => {
            console.log('Socket connected!', socket.id);
            setIsConnected(true);

            const token = getSessionToken();
            socket.emit('authenticate', token);
        };

        const onDisconnect = () => {
            console.log('Socket disconnected');
            setIsConnected(false);
        };

        const onUpdate = (newState) => {
            setPlayerState(newState);
            setMatchStarted(true);

            // Reset local committed state ONLY when the turn has advanced
            if (newState.turn > turnRef.current) {
                setCommittedActions([]);
                setSelectedHubId(null);
                setLaunchMode(false);
                turnRef.current = newState.turn;
            }
        };

        const onAssignment = (assignedId) => {
            console.log('Assigned as:', assignedId);
            setMyPlayerId(assignedId);
        };

        const onSyncStatus = (status) => {
            setSyncStatus(status);
        };

        const onTimerUpdate = (timeLeft) => {
            setTimeRemaining(timeLeft);
        };

        const onLobbyUpdate = (update) => {
            console.log('Lobby update:', update);
            setLobbyStatus(update);
            if (update.status === 'IN_GAME') {
                setMatchStarted(true);
            }
        };

        const onMatchStarted = (data) => {
            console.log('Match started!', data);
            setMatchStarted(true);
            // After match starts, we might need a fresh assignment
            const token = getSessionToken();
            socket.emit('authenticate', token);
            socket.emit('requestState');
        };

        // CRASH REPORTER: Catch any runtime errors and show them on screen
        const handleGlobalError = (event) => {
            setLastError(`CRASH: ${event.message} at ${event.filename}:${event.lineno}`);
        };
        window.addEventListener('error', handleGlobalError);

        const onError = (err) => {
            console.error('Socket connection error:', err);
            setIsConnected(false);
            setLastError(err.message || JSON.stringify(err));
        };

        const onResolutionStatus = (status) => {
            setIsResolving(status.active);
            if (status.active) {
                // As soon as resolution officially starts, clear local staged actions
                // so they don't overlap with the server-side simulation projectiles.
                setCommittedActions([]);
            }
        };

        const onMatchRestarted = () => {
            console.log('Match restarted! Re-authenticating...');
            setMatchStarted(false);
            const token = getSessionToken();
            socket.emit('authenticate', token);
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
        socket.on('connect_error', onError);

        // Initial check in case it connected before the effect ran
        if (socket.connected) onConnect();

        return () => {
            window.removeEventListener('error', handleGlobalError);
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
            socket.off('connect_error', onError);
        };
    }, []);

    useEffect(() => {
        if (!isLocked && !isResolvingUI && committedActions.length >= 0) {
            socket.emit('syncActions', committedActions);
        }
    }, [committedActions, isLocked, isResolvingUI]);

    // Update hub screen position whenever selectedHubId, camera, or state changes
    useEffect(() => {
        if (!selectedHubId || !playerState) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setHubScreenPos(null);
            return;
        }
        const hub = playerState.entities.find(e => e.id === selectedHubId);
        if (!hub || !gameBoardRef.current) return;

        const pos = gameBoardRef.current.getScreenCoords(hub.x, hub.y);

        // Normalize viewport-absolute pos to the .game-world container
        const gameWorld = document.querySelector('.game-world');
        if (gameWorld) {
            const rect = gameWorld.getBoundingClientRect();
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setHubScreenPos({
                x: pos.x - rect.left,
                y: pos.y - rect.top
            });
        }
    }, [selectedHubId, cameraOffset, playerState, hubScreenPos]);

    // Close menu when resolution starts or turn is submitted
    useEffect(() => {
        if (isResolvingUI || isLocked) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSelectedHubId(null);
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLaunchMode(false);
        }
    }, [isResolvingUI, isLocked]);

    const pBase =
        playerState?.players && playerState.players[myPlayerId]
            ? playerState.players[myPlayerId]
            : { energy: 0, color: '#fff', alive: true };

    const pendingCost = committedActions.reduce(
        (sum, act) => {
            const stats = ENTITY_STATS[act.itemType];
            return sum + (stats?.cost || 0);
        },
        0
    );
    const pCurrent = {
        ...pBase,
        energy: Math.max(0, pBase.energy - pendingCost)
    };

    const isSpectator = myPlayerId === 'spectator';
    const isUnassigned = !myPlayerId;
    const interactionBlocked = isLocked || isResolvingUI || isSpectator || isUnassigned;

    const header = (
        <header className="game-header">
            <div className="player-info" style={{ color: pCurrent.color }}>
                <h1>Titan: Nexus Command</h1>
                <div className="status-bars">
                    <span className="badge">You: {myPlayerId || 'Pending'}</span>
                    <span className="energy">Energy: {pCurrent.energy}</span>
                    {(() => {
                        let projectedIncome = GLOBAL_STATS.ENERGY_INCOME_PER_TURN;
                        if (playerState?.entities && myPlayerId && !isSpectator) {
                            playerState.entities.forEach((entity) => {
                                if (entity.owner === myPlayerId) {
                                    if (entity.disabledUntilTurn > playerState.turn) return;

                                    const stats = ENTITY_STATS[entity.type];
                                    if (stats && stats.energyGen) {
                                        projectedIncome += stats.energyGen;
                                        if (entity.type === 'EXTRACTOR') {
                                            const node = playerState.map.resources.find((res) => {
                                                let dx = Math.abs(res.x - entity.x);
                                                let dy = Math.abs(res.y - entity.y);
                                                if (dx > playerState.map.width / 2)
                                                    dx = playerState.map.width - dx;
                                                if (dy > playerState.map.height / 2)
                                                    dy = playerState.map.height - dy;
                                                const dist = Math.sqrt(dx * dx + dy * dy);
                                                return dist <= GLOBAL_STATS.RESOURCE_CAPTURE_RADIUS;
                                            });
                                            if (node) projectedIncome += node.value;
                                        }
                                    }
                                }
                            });
                        }
                        return (
                            <span className="income" title="Projected income next turn">
                                {' '}
                                (+{projectedIncome})
                            </span>
                        );
                    })()}
                    <span className="turn">Turn: {playerState?.turn || 1}</span>
                    <span className={`timer ${timeRemaining <= 10 ? 'low' : ''}`}>
                        Time: {timeRemaining}s
                    </span>
                </div>
            </div>

            <div className="sync-monitor">
                <div
                    className={`player-dot ${syncStatus?.lockedIn?.player1 ? 'ready' : ''}`}
                    title="Player 1"
                >
                    P1
                </div>
                <div
                    className={`player-dot ${syncStatus?.lockedIn?.player2 ? 'ready' : ''}`}
                    title="Player 2"
                >
                    P2
                </div>
            </div>

            <div className="controls">
                <div className="debug-toggle">
                    <label>
                        <input
                            type="checkbox"
                            checked={showDebugPreview}
                            onChange={(e) => setShowDebugPreview(e.target.checked)}
                        />
                        Show Landing Preview
                    </label>
                </div>

                {committedActions.length > 0 && !interactionBlocked && (
                    <button className="clear-btn" onClick={handleClearActions}>
                        Clear All ({committedActions.length})
                    </button>
                )}

                <button
                    className={`execute-btn ${isLocked ? 'waiting' : ''}`}
                    onClick={handleExecuteTurn}
                    disabled={interactionBlocked}
                >
                    {isResolvingUI
                        ? 'Resolving...'
                        : isLocked
                            ? 'Waiting for others...'
                            : isSpectator
                                ? 'Observation Only'
                                : isUnassigned
                                    ? '...'
                                    : committedActions.length > 0
                                        ? `Complete Turn (${committedActions.length})`
                                        : 'Complete Turn'}
                </button>
            </div>
        </header >
    );

    if (!matchStarted) {
        return (
            <div className="App">
                <LobbyOverlay
                    lobbyUpdate={lobbyStatus}
                    onClaimSeat={handleClaimSeat}
                    onReadyToggle={handleReadyToggle}
                    socketId={socket.id}
                />
            </div>
        );
    }

    if (!playerState || !myPlayerId) {
        return (
            <div className="App">
                {header}
                <div className="loading-screen" style={{ minHeight: '300px' }}>
                    <p>{!playerState ? 'Downloading Sector Data...' : 'Authenticating Pilot...'}</p>
                    <div className="status-indicator">
                        Socket: {isConnected ? 'Online' : 'Offline'} | ID: {myPlayerId || 'Pending'}
                    </div>
                    {lastError && (
                        <div
                            className="error-display"
                            style={{ color: '#ff6464', marginTop: '10px' }}
                        >
                            Error: {lastError}
                        </div>
                    )}
                    {!isConnected && (
                        <button
                            onClick={() => {
                                setLastError(null);
                                socket.connect();
                            }}
                            style={{ marginTop: '10px' }}
                        >
                            Reconnect
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="App">
            {header}

            <main className={`game-world ${isResolvingUI ? 'locked-out' : ''}`}>
                {!isResolvingUI && !committedActions.length && selectedHubId && launchMode && (
                    <div className="hint-overlay">Drag from your selected Hub to launch</div>
                )}

                <GameBoard
                    ref={gameBoardRef}
                    gameState={playerState}
                    myPlayerId={myPlayerId}
                    selectedHubId={selectedHubId}
                    selectedItemType={selectedItemType}
                    launchMode={launchMode}
                    isAiming={isAiming}
                    committedActions={committedActions}
                    showDebugPreview={showDebugPreview}
                    maxPullDistance={MAX_PULL_DISTANCE}
                    isResolving={isResolvingUI}
                    cameraOffset={cameraOffset}
                    setCameraOffset={setCameraOffset}
                    onSelectHub={(id) => {
                        setSelectedHubId(id);
                    }}
                    onAimStart={handleAimStart}
                    onAimUpdate={() => { }}
                    onAimEnd={handleAimEnd}
                />

                {selectedHubId && !launchMode && !interactionBlocked && playerState && (() => {
                    const hub = playerState.entities.find(e => e.id === selectedHubId);
                    if (!hub) {
                        console.log('RadialMenu check: Hub not found for ID', selectedHubId);
                        return null;
                    }

                    // We need to calculate where the hub is on screen
                    // GameBoard already has the math, but we'll approximate/sync here
                    // or ideally get it from the gameBoardRef if we added a method.
                    // For now, let's assume GameBoard exposes it or we calculate it.
                    return (
                        <RadialMenu
                            x={hubScreenPos?.x || 0}
                            y={hubScreenPos?.y || 0}
                            playerEnergy={pCurrent.energy}
                            hubFuel={hub.fuel !== undefined ? hub.fuel - committedActions.filter(a => a.sourceId === selectedHubId).length : 99}
                            onSelect={(type) => {
                                setSelectedItemType(type);
                                setLaunchMode(true);
                            }}
                            onCancel={() => setSelectedHubId(null)}
                        />
                    );
                })()}

                {launchMode && !isResolvingUI && (
                    <div className="hint-overlay">Pull back from the Hub to Aim & Launch!</div>
                )}
            </main>

            <footer className="debug-info">
                <p>
                    {isSpectator
                        ? "You are observing this match."
                        : selectedHubId
                            ? `Hub ${selectedHubId} Selected. ${launchMode ? 'Action: Pull back to sling!' : 'Click "Launch" to aim.'}`
                            : 'Click your Hub to select it.'}
                </p>
            </footer>

            {playerState.winner && (
                <div className="winner-overlay">
                    <div
                        className="winner-card"
                        style={{
                            borderColor: playerState.players[playerState.winner]?.color || '#fff'
                        }}
                    >
                        <h2>{playerState.winner === 'DRAW' ? "It's a Draw!" : 'Victory!'}</h2>
                        <p>
                            {playerState.winner === 'DRAW'
                                ? 'Mutual destruction on Titan.'
                                : `Player ${playerState.winner} has conquered the sector.`}
                        </p>
                        <button className="restart-btn" onClick={handleRestart}>
                            Initialize New Mission
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
