import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { GameState } from '../../shared/GameState.js';
import { ENTITY_STATS, GLOBAL_STATS } from '../../shared/constants/EntityStats.js';
import GameBoard from './components/GameBoard';
import RadialMenu from './components/RadialMenu';
import { LobbyOverlay } from './components/LobbyOverlay';
import MapDesigner from './components/MapDesigner';
import { io } from 'socket.io-client';
import AssetGallery from './components/AssetGallery';
import { audioManager, TRACKS } from './utils/AudioManager';
import SidebarLeft from './components/HUD/SidebarLeft';
import SidebarRight from './components/HUD/SidebarRight';

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
    const [audioVolume, setAudioVolume] = useState(0.5);
    const [audioMuted, setAudioMuted] = useState(false);
    const [currentTrackPath, setCurrentTrackPath] = useState('/audio/tracks/twimble.mod');
    const [audioPlaying, setAudioPlaying] = useState(false);
    const [audioShuffle, setAudioShuffle] = useState(false);

    // Subscribe to AudioManager's real-time changes to keep React UI in absolute sync
    useEffect(() => {
        const unsubscribe = audioManager.subscribe((state) => {
            setCurrentTrackPath(state.currentTrack || '/audio/tracks/twimble.mod');
            setAudioPlaying(state.isPlaying);
            setAudioMuted(state.isMuted);
            setAudioVolume(state.volume);
            setAudioShuffle(state.shuffle);
        });
        return unsubscribe;
    }, []);
 
    const handleVolumeChange = (e) => {
        const val = parseFloat(e.target.value);
        audioManager.setVolume(val);
    };
 
    const handleMuteToggle = () => {
        audioManager.toggleMute();
    };
 
    const handlePlayPauseToggle = () => {
        if (audioManager.isPlaying) {
            audioManager.pauseMusic();
        } else {
            audioManager.resumeMusic();
        }
    };
 
    const handleNextTrack = async () => {
        await audioManager.nextTrack();
    };
 
    const handlePrevTrack = async () => {
        await audioManager.prevTrack();
    };
 
    const handleShuffleToggle = () => {
        audioManager.toggleShuffle();
    };
 
    const handleTrackChange = (path) => {
        audioManager.playMusic(path);
    };
    const [syncStatus, setSyncStatus] = useState({ lockedIn: { player1: false, player2: false } });
    const [lastError, setLastError] = useState(null);
    const [availableMaps, setAvailableMaps] = useState([]);
    const [selectedHubId, setSelectedHubId] = useState(null);
    const [selectedItemType, setSelectedItemType] = useState('HUB');
    const [launchMode, setLaunchMode] = useState(false);
    const [isAiming, setIsAiming] = useState(false);
    const [committedActions, setCommittedActions] = useState([]);
    const [showDebugPreview] = useState(true);
    const [timeRemaining, setTimeRemaining] = useState(30);
    const [isResolving, setIsResolving] = useState(false);
    const [glitchActive, setGlitchActive] = useState(false);
    const [currentView, setCurrentView] = useState('LOBBY'); // 'LOBBY', 'GAME', 'DESIGNER'

    // Lobby State
    const [lobbyStatus, setLobbyStatus] = useState(null);
    const [matchStarted, setMatchStarted] = useState(false);
    const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(2); // Dynamic Zoom state
    const [minZoom] = useState(1.0);
    const viewportRef = useRef(null);

    // Help RadialMenu track its hub
    const [hubScreenPos, setHubScreenPos] = useState(null);
    const gameBoardRef = useRef(null);

    // Warm up AudioContext on standard user interaction
    useEffect(() => {
        const warmUpAudio = () => {
            audioManager.playMusic(currentTrackPath);
            window.removeEventListener('click', warmUpAudio);
        };
        window.addEventListener('click', warmUpAudio);
        return () => window.removeEventListener('click', warmUpAudio);
    }, [currentTrackPath]);

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
            audioManager.playActionReset();
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

        if (selectedItemType === 'LINK') {
            audioManager.playLinkStage();
        } else {
            audioManager.playClick();
        }

        setCommittedActions((prev) => [...prev, action]);
        setLaunchMode(false);
        setSelectedHubId(null);
    };

    const handleExecuteTurn = () => {
        audioManager.playUplink();
        if (committedActions.length > 0) {
            socket.emit('submitActions', committedActions);
        } else {
            socket.emit('passTurn');
        }
    };

    const handleClearActions = () => {
        audioManager.playActionReset();
        setCommittedActions([]);
        setLaunchMode(false);
    };

    const handleRestart = () => {
        audioManager.playActionReset();
        socket.emit('restartGame');
        setCommittedActions([]);
        setSelectedHubId(null);
        setLaunchMode(false);
        setMatchStarted(false);
    };

    const handleClaimSeat = (index) => {
        audioManager.playSeatClaim();
        socket.emit('lobby:claimSeat', index);
    };

    const handleReadyToggle = (isReady) => {
        audioManager.playClick();
        socket.emit('lobby:ready', isReady);
    };

    const handleSetMap = (mapName) => {
        audioManager.playClick();
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
                audioManager.playRoundStart();
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
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setZoom(prev => Math.max(1.0, Math.min(3.0, prev)));
    }, [playerState?.map]);

    const handleWheel = useCallback((e) => {
        e.preventDefault();

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
    }, [zoom, isResolvingUI, playerState, setCameraOffset, setZoom]);

    // Use a Ref to ensure the non-passive native event listener always gets
    // the freshest state closure without needing constant event re-binding.
    const handleWheelRef = useRef(handleWheel);
    useEffect(() => {
        handleWheelRef.current = handleWheel;
    }, [handleWheel]);

    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;

        const onWheelNative = (e) => {
            if (handleWheelRef.current) {
                handleWheelRef.current(e);
            }
        };

        viewport.addEventListener('wheel', onWheelNative, { passive: false });
        return () => {
            viewport.removeEventListener('wheel', onWheelNative);
        };
    }, [matchStarted, playerState, myPlayerId, currentView]);

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

             
            setHubScreenPos({ x: nx, y: ny });
        } else {
             
            setHubScreenPos(pos);
        }
    }, [selectedHubId, cameraOffset, zoom, playerState]);

    // Close menu when resolution starts or turn is submitted
    useEffect(() => {
        if (isResolvingUI || isLocked) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSelectedHubId(null);
             
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
        <SidebarLeft
            myPlayerId={myPlayerId}
            pCurrent={pCurrent}
            playerState={playerState}
            isSpectator={isSpectator}
            selectedHubId={selectedHubId}
            audioVolume={audioVolume}
            audioMuted={audioMuted}
            currentTrackPath={currentTrackPath}
            audioPlaying={audioPlaying}
            audioShuffle={audioShuffle}
            handleVolumeChange={handleVolumeChange}
            handleMuteToggle={handleMuteToggle}
            handlePlayPauseToggle={handlePlayPauseToggle}
            handlePrevTrack={handlePrevTrack}
            handleNextTrack={handleNextTrack}
            handleShuffleToggle={handleShuffleToggle}
            handleTrackChange={handleTrackChange}
        />
    );

    const sidebarRight = (
        <SidebarRight
            syncStatus={syncStatus}
            playerState={playerState}
            timeRemaining={timeRemaining}
            showDebugPreview={showDebugPreview}
            cameraOffset={cameraOffset}
            zoom={zoom}
            committedActions={committedActions}
            interactionBlocked={interactionBlocked}
            handleClearActions={handleClearActions}
            handleExecuteTurn={handleExecuteTurn}
            isLocked={isLocked}
            isResolvingUI={isResolvingUI}
            isSpectator={isSpectator}
            isUnassigned={isUnassigned}
        />
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

        // Convert player HSL to comma-separated RGB values for repeating-linear-gradient
        if (playerColor.startsWith('hsl')) {
            const matches = playerColor.match(/\d+/g);
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
                document.documentElement.style.setProperty('--player-accent-color-rgb', `${r}, ${g}, ${b}`);
            }
        } else {
            // Hex fallback green rgb (0, 255, 68)
            document.documentElement.style.setProperty('--player-accent-color-rgb', '0, 255, 68');
        }
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
                    socket={socket}
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

                <div className="viewport-crt-container" ref={viewportRef}>
                    <div className="crt-scanlines-pixel-perfect" />
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
                </div>

                {sidebarRight}
            </>
        );
    };


    const isGalleryMode = new URLSearchParams(window.location.search).get('gallery') === 'true';

    if (isGalleryMode) {
        return <AssetGallery />;
    }

    return (
        <div className="App">
            {renderContent()}
        </div>
    );
}

export default App;
