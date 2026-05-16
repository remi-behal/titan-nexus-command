import { useState, useEffect, useRef } from 'react';
import './App.css';
import { GameState } from '../../shared/GameState.js';
import { ENTITY_STATS, GLOBAL_STATS } from '../../shared/constants/EntityStats.js';
import GameBoard from './components/GameBoard';
import RadialMenu from './components/RadialMenu';
import { LobbyOverlay } from './components/LobbyOverlay';
import MapDesigner from './components/MapDesigner';
import { io } from 'socket.io-client';
import CRTEffect from 'vault66-crt-effect';
import "vault66-crt-effect/dist/vault66-crt-effect.css";
import AssetGallery from './components/AssetGallery';

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
    const [availableMaps, setAvailableMaps] = useState([]);
    const [selectedHubId, setSelectedHubId] = useState(null);
    const [selectedItemType, setSelectedItemType] = useState('HUB');
    const [launchMode, setLaunchMode] = useState(false);
    const [isAiming, setIsAiming] = useState(false);
    const [committedActions, setCommittedActions] = useState([]);
    const [showDebugPreview, setShowDebugPreview] = useState(true);
    const [timeRemaining, setTimeRemaining] = useState(30);
    const [isResolving, setIsResolving] = useState(false);
    const [glitchActive, setGlitchActive] = useState(false);
    const [currentView, setCurrentView] = useState('LOBBY'); // 'LOBBY', 'GAME', 'DESIGNER'

    // Lobby State
    const [lobbyStatus, setLobbyStatus] = useState(null);
    const [matchStarted, setMatchStarted] = useState(false);
    const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(2); // Dynamic Zoom state
    const [minZoom, setMinZoom] = useState(1.0);
    const viewportRef = useRef(null);

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

        const launchDistance = GameState.calculateLaunchDistance(distance);
        const rad = (angle * Math.PI) / 180;
        const targetX = (hub.x + Math.cos(rad) * launchDistance + playerState.map.width) % playerState.map.width;
        const targetY = (hub.y + Math.sin(rad) * launchDistance + playerState.map.height) % playerState.map.height;

        const isInvalid = GameState.checkLinkAngleSeparation(
            selectedItemType,
            selectedHubId,
            targetX,
            targetY,
            playerState.links,
            committedActions,
            playerState.entities,
            playerState.map
        );

        if (isInvalid) {
            // Trigger rejection glitch
            setGlitchActive(true);
            setTimeout(() => setGlitchActive(false), 400);
            
            setLaunchMode(false);
            setSelectedHubId(null);
            return;
        }

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
        setSelectedHubId(null);
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

    const handleSetMap = (mapName) => {
        socket.emit('lobby:setMap', mapName);
    };

    const handleMapSave = (mapData) => {
        const name = prompt('Enter a name for your map:');
        if (name) {
            socket.emit('map:save', { name, data: mapData });
        }
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

            // AUTO-START LOGIC
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('autoStart') === '1' && !assignedId) {
                console.log('[AutoStart] Attempting auto-join (Solo Mode)...');
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

        const onMapsUpdate = (maps) => {
            setAvailableMaps(maps);
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
        socket.on('room:mapsUpdate', onMapsUpdate);
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
            socket.off('room:mapsUpdate', onMapsUpdate);
            socket.off('connect_error', onError);
        };
    }, []);

    // Minimum zoom is fixed to 1.0 because the canvas internal resolution 
    // is set to match the map dimensions (2000x2000). 
    // Zooming below 1.0 would show empty space on the internal canvas.
    useEffect(() => {
        // Force zoom into legal range if it was outside (e.g. on load)
        setZoom(prev => Math.max(1.0, Math.min(3.0, prev)));
    }, [playerState?.map]);

    const handleWheel = (e) => {
        if (!viewportRef.current || isResolvingUI) return;

        const zoomSpeed = 0.001;
        const delta = -e.deltaY * zoomSpeed;
        const newZoom = Math.max(1.0, Math.min(3.0, zoom + delta));

        if (Math.abs(newZoom - zoom) < 0.0001) return;

        // Zoom-at-cursor logic
        const rect = viewportRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const mapW = playerState.map.width || 2000;
        const mapH = playerState.map.height || 2000;

        setCameraOffset(prev => ({
            x: (prev.x + mouseX * (1 / zoom - 1 / newZoom) + mapW) % mapW,
            y: (prev.y + mouseY * (1 / zoom - 1 / newZoom) + mapH) % mapH
        }));

        setZoom(newZoom);
    };

    useEffect(() => {
        if (!matchStarted && currentView === 'LOBBY') {
            socket.emit('room:listMaps');
        }
    }, [matchStarted, currentView]);

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
            const nx = pos.x - rect.left;
            const ny = pos.y - rect.top;

            // eslint-disable-next-line react-hooks/set-state-in-effect
            setHubScreenPos({ x: nx, y: ny });
        } else {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setHubScreenPos(pos);
        }
    }, [selectedHubId, cameraOffset, zoom, playerState]);

    // Close menu when resolution starts or turn is submitted
    useEffect(() => {
        if (isResolvingUI || isLocked) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSelectedHubId(null);
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLaunchMode(false);
        }
    }, [isResolvingUI, isLocked]);

    const pBase = (() => {
        // 1. If match is active, use the game state
        if (matchStarted && playerState?.players?.[myPlayerId]) {
            return playerState.players[myPlayerId];
        }
        // 2. If in lobby, find our slot color
        if (lobbyStatus?.slots && myPlayerId) {
            const slotIndex = lobbyStatus.slots.findIndex((s, idx) => `player${idx + 1}` === myPlayerId);
            if (slotIndex !== -1 && lobbyStatus.slots[slotIndex]) {
                // Match the colors used in GameState.js: hsl(index * 60, 70%, 50%)
                return { color: `hsl(${slotIndex * 60}, 70%, 50%)` };
            }
        }
        // 3. Absolute fallback (Spectator or unassigned)
        return { color: '#00ff44' };
    })();

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

    const sidebarLeft = (
        <aside className="sidebar-left">
            <div className="player-info" style={{ color: pCurrent.color }}>
                <h1>Titan: Nexus</h1>
                <div className="stats-blocks">
                    <div className="stat-group">
                        <span className="label">You:</span>
                        <span className="badge">{myPlayerId || 'Pending'}</span>
                    </div>
                    <div className="stat-group energy-group">
                        <span className="label">Energy:</span>
                        <span className="value energy">{pCurrent.energy}</span>
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
                                    (+{projectedIncome})
                                </span>
                            );
                        })()}
                    </div>
                </div>
            </div>

            <div className="footer-hint">
                {isSpectator
                    ? "Observing match."
                    : selectedHubId
                        ? `Hub ${selectedHubId} Selected.`
                        : 'Select Hub.'}
            </div>
        </aside>
    );

    const sidebarRight = (
        <aside className="sidebar-right">
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

            <div className="controls-stack">
                <div className="stats-blocks">
                    <div className="stat-group">
                        <span className="label">Turn:</span>
                        <span className="value turn">{playerState?.turn || 1}</span>
                    </div>
                    <div className="stat-group timer-group">
                        <span className="label">Time:</span>
                        <span className={`value timer ${timeRemaining <= 10 ? 'low' : ''}`}>
                            {timeRemaining}s
                        </span>
                    </div>
                </div>

                {committedActions.length > 0 && !interactionBlocked && (
                    <button className="clear-btn" onClick={handleClearActions}>
                        Clear ({committedActions.length})
                    </button>
                )}

                <div className="spacer" style={{ flex: 1 }} />

                <button
                    className={`execute-btn ${isLocked ? 'waiting' : ''}`}
                    onClick={handleExecuteTurn}
                    disabled={interactionBlocked}
                >
                    {isResolvingUI
                        ? 'Simulating'
                        : isLocked
                            ? 'Waiting'
                            : isSpectator
                                ? 'Spectating'
                                : isUnassigned
                                    ? '...'
                                    : committedActions.length > 0
                                        ? `Ready (${committedActions.length})`
                                        : 'Ready'}
                </button>
            </div>
        </aside>
    );

    const playerColor = pBase?.color || '#00ff44';
    // Strict color helper for CRT phosphor (requires rgba format)
    const getCRTColor = (color, alpha) => {
        if (!color || color === '#00ff44') return `rgba(0, 255, 68, ${alpha})`;

        // 1. Convert Titan HSL to RGB
        if (color.startsWith('hsl')) {
            const matches = color.match(/\d+/g);
            if (matches && matches.length >= 3) {
                const h = parseInt(matches[0]);
                const s = parseInt(matches[1]) / 100;
                const l = parseInt(matches[2]) / 100;

                const k = n => (n + h / 30) % 12;
                const a = s * Math.min(l, 1 - l);
                const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

                const r = Math.round(255 * f(0));
                const g = Math.round(255 * f(8));
                const b = Math.round(255 * f(4));

                return `rgba(${r}, ${g}, ${b}, ${alpha})`;
            }
        }

        // 2. Fallback for hex or other formats
        return `rgba(0, 255, 68, ${alpha})`;
    };

    const crtColor = getCRTColor(playerColor, 0.4);

    // Update global CSS variables for UI elements
    useEffect(() => {
        document.documentElement.style.setProperty('--player-accent-color', playerColor);
        document.documentElement.style.setProperty('--player-accent-glow', crtColor);
    }, [playerColor, crtColor]);

    const renderContent = () => {
        if (currentView === 'DESIGNER') {
            return (
                <MapDesigner
                    onSave={handleMapSave}
                    onBack={() => setCurrentView('LOBBY')}
                />
            );
        }

        if (!matchStarted) {
            return (
                <LobbyOverlay
                    lobbyUpdate={lobbyStatus}
                    availableMaps={availableMaps}
                    onClaimSeat={handleClaimSeat}
                    onReadyToggle={handleReadyToggle}
                    onSetMap={handleSetMap}
                    onOpenDesigner={() => setCurrentView('DESIGNER')}
                    socketId={socket.id}
                />
            );
        }

        if (!playerState || !myPlayerId) {
            return (
                <>
                    {sidebarLeft}
                    <div className="viewport-crt-container">
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
                    {sidebarRight}
                </>
            );
        }

        return (
            <>
                {sidebarLeft}

                <div className="viewport-crt-container" ref={viewportRef} onWheel={handleWheel}>
                    <CRTEffect
                        key={playerColor}
                        theme="custom"
                        scanlineColor={crtColor}
                        edgeGlowColor={crtColor}
                        glowColor={crtColor}
                        enableEdgeGlow={false}
                        enableScanlines={true}
                        enableGlow={false}
                        enableSweep={false}
                        scanlineOpacity={0.2}
                        scanlineThickness={1}
                        scanlineGap={4}
                        enableVignette={true}
                        vignetteIntensity={0.2}
                    >
                        <main className={`game-world ${isResolvingUI ? 'locked-out' : ''} ${glitchActive ? 'glitch-rejection' : ''}`}>
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
                                zoom={zoom}
                                setZoom={setZoom}
                                minZoom={minZoom}
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
                    </CRTEffect>
                </div>

                {sidebarRight}
            </>
        );
    };


    const isGalleryMode = new URLSearchParams(window.location.search).get('gallery') === 'true';

    return (
        <div className="App">
            {isGalleryMode ? <AssetGallery /> : renderContent()}
        </div>
    );
}

export default App;
