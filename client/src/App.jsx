import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { GameState } from '../../shared/GameState.js';
import { ENTITY_STATS, GLOBAL_STATS } from '../../shared/constants/EntityStats.js';
import GameBoard from './components/GameBoard';
import RadialMenu from './components/RadialMenu';
import { LobbyOverlay } from './components/LobbyOverlay';
import { RoomBrowser } from './components/RoomBrowser';
import MapDesigner from './components/MapDesigner';
import AssetGallery from './components/AssetGallery';
import { audioManager } from './utils/AudioManager';
import SidebarLeft from './components/HUD/SidebarLeft';
import SidebarRight from './components/HUD/SidebarRight';
import ChatPanel from './components/HUD/ChatPanel';
import { useGameSocket, socket } from './hooks/useGameSocket';
import playgroundMap from '../../shared/ready_maps/playground.json';

const MAX_PULL_DISTANCE = GLOBAL_STATS.MAX_PULL;

function App() {
    const {
        isConnected,
        myPlayerId,
        playerState,
        lobbyStatus,
        matchStarted,
        syncStatus,
        timeRemaining,
        isResolving,
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
    } = useGameSocket();

    const turnRef = useRef(1); // Track turn for stale closures in listeners
    const [selectedHubId, setSelectedHubId] = useState(null);
    const [selectedItemType, setSelectedItemType] = useState('HUB');
    const [launchMode, setLaunchMode] = useState(false);
    const [isAiming, setIsAiming] = useState(false);
    const [showDebugPreview] = useState(true);
    const [glitchActive, setGlitchActive] = useState(false);
    const [currentView, setCurrentView] = useState('LOBBY'); // 'LOBBY', 'GAME', 'DESIGNER', 'SANDBOX'

    // Sandbox specific state
    const [sandboxState, setSandboxState] = useState(null);
    const [activeSandboxPlayer, setActiveSandboxPlayer] = useState('player1');
    const [sandboxActions, setSandboxActions] = useState([]);
    const localGameRef = useRef(null);
    const [isSandboxResolving, setIsSandboxResolving] = useState(false);

    const handleOpenSandbox = () => {
        const g = new GameState();
        g.initializeGame(['player1', 'player2'], playgroundMap);
        g.players.player1.energy = 9999;
        g.players.player2.energy = 9999;
        g.players.player1.color = 'hsl(0, 85%, 60%)';
        g.players.player2.color = 'hsl(60, 85%, 60%)';
        localGameRef.current = g;
        setSandboxState(g.getState());
        setSandboxActions([]);
        setActiveSandboxPlayer('player1');
        setCurrentView('SANDBOX');
    };

    const handleExecuteSandboxTurn = async () => {
        if (!localGameRef.current || isSandboxResolving) return;
        setIsSandboxResolving(true);

        const p1Actions = sandboxActions.filter((a) => a.playerId === 'player1');
        const p2Actions = sandboxActions.filter((a) => a.playerId === 'player2');

        const snapshots = localGameRef.current.resolveTurn({
            player1: p1Actions,
            player2: p2Actions
        });

        for (const snap of snapshots) {
            setSandboxState(snap.state);
            const delay = snap.type === 'ROUND_SUB' ? 60 : 1500;
            await new Promise((resolve) => setTimeout(resolve, delay));
        }

        setSandboxActions([]);
        localGameRef.current.players.player1.energy = 9999;
        localGameRef.current.players.player2.energy = 9999;
        setSandboxState(localGameRef.current.getState());
        setIsSandboxResolving(false);
    };

    const handleSandboxAimStart = (overrideHubId) => {
        const targetHubId = overrideHubId || selectedHubId;
        if (!targetHubId) return;

        const selectedEntity = sandboxState?.entities?.find((e) => e.id === targetHubId);
        const pendingFuelSpent = sandboxActions.filter((a) => a.sourceId === targetHubId).length;
        const hasFuel = selectedEntity
            ? selectedEntity.fuel === undefined || selectedEntity.fuel - pendingFuelSpent > 0
            : false;

        if (launchMode && hasFuel) {
            setIsAiming(true);
        }
    };

    const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(2); // Dynamic Zoom state
    const [minZoom] = useState(1.0);
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
        const targetX =
            (hub.x + Math.cos(rad) * launchDistance + playerState.map.width) %
            playerState.map.width;
        const targetY =
            (hub.y + Math.sin(rad) * launchDistance + playerState.map.height) %
            playerState.map.height;

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

    const triggerRestart = () => {
        audioManager.playActionReset();
        handleRestart();
        setSelectedHubId(null);
        setLaunchMode(false);
    };

    const triggerClaimSeat = (index) => {
        audioManager.playSeatClaim();
        handleClaimSeat(index);
    };

    const triggerReadyToggle = (isReady) => {
        audioManager.playClick();
        handleReadyToggle(isReady);
    };

    const triggerSetMap = (mapName) => {
        audioManager.playClick();
        handleSetMap(mapName);
    };

    const triggerSetTeam = (team) => {
        audioManager.playClick();
        handleSetTeam(team);
    };

    // CRASH REPORTER: Catch any runtime errors and show them on screen
    useEffect(() => {
        const handleGlobalError = (event) => {
            setLastError(`CRASH: ${event.message} at ${event.filename}:${event.lineno}`);
        };
        window.addEventListener('error', handleGlobalError);
        return () => window.removeEventListener('error', handleGlobalError);
    }, [setLastError]);

    // UI state adjustments when turn advances
    useEffect(() => {
        if (playerState?.turn > turnRef.current) {
            setSelectedHubId(null);
            setLaunchMode(false);
            turnRef.current = playerState.turn;
            audioManager.playRoundStart();
        }
    }, [playerState?.turn]);

    // Force zoom into legal range if it was outside (e.g. on load)
    useEffect(() => {
        setZoom((prev) => Math.max(1.0, Math.min(3.0, prev)));
    }, [playerState?.map, sandboxState?.map, currentView]);

    const handleWheel = useCallback(
        (e) => {
            e.preventDefault();

            const resolving = currentView === 'SANDBOX' ? isSandboxResolving : isResolvingUI;
            if (!viewportRef.current || resolving) return;

            const activeState = currentView === 'SANDBOX' ? sandboxState : playerState;
            if (!activeState?.map) return;

            const zoomSpeed = 0.001;
            const delta = -e.deltaY * zoomSpeed;
            const newZoom = Math.max(1.0, Math.min(3.0, zoom + delta));

            if (Math.abs(newZoom - zoom) < 0.0001) return;

            // Zoom-at-cursor logic
            const rect = viewportRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const mapW = activeState.map.width || 2000;
            const mapH = activeState.map.height || 2000;

            setCameraOffset((prev) => ({
                x: (prev.x + mouseX * (1 / zoom - 1 / newZoom) + mapW) % mapW,
                y: (prev.y + mouseY * (1 / zoom - 1 / newZoom) + mapH) % mapH
            }));

            setZoom(newZoom);
        },
        [zoom, isResolvingUI, isSandboxResolving, playerState, sandboxState, currentView, setCameraOffset, setZoom]
    );

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
    }, [matchStarted, playerState, sandboxState, myPlayerId, currentView]);

    useEffect(() => {
        if (!matchStarted && currentView === 'LOBBY') {
            socket.emit('room:listMaps');
        }
    }, [matchStarted, currentView]);

    // Update hub screen position whenever selectedHubId, camera, or state changes
    useEffect(() => {
        const activeState = currentView === 'SANDBOX' ? sandboxState : playerState;
        if (!selectedHubId || !activeState) {
            setHubScreenPos(null);
            return;
        }
        const hub = activeState.entities.find((e) => e.id === selectedHubId);
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
    }, [selectedHubId, cameraOffset, zoom, playerState, sandboxState, currentView]);

    // Close menu when resolution starts or turn is submitted
    useEffect(() => {
        if (isResolvingUI || isLocked || isSandboxResolving) {
            setSelectedHubId(null);
            setLaunchMode(false);
        }
    }, [isResolvingUI, isLocked, isSandboxResolving]);

    const pBase = (() => {
        // 1. If match is active, use the game state
        if (matchStarted && playerState?.players?.[myPlayerId]) {
            return playerState.players[myPlayerId];
        }
        // 2. If in lobby, find our slot color
        if (lobbyStatus?.slots && myPlayerId) {
            const slotIndex = lobbyStatus.slots.findIndex(
                (s, idx) => `player${idx + 1}` === myPlayerId
            );
            if (slotIndex !== -1 && lobbyStatus.slots[slotIndex]) {
                // Match the colors used in GameState.js: hsl(index * 60, 85%, 60%)
                return { color: `hsl(${slotIndex * 60}, 85%, 60%)` };
            }
        }
        // 3. Absolute fallback (Spectator or unassigned)
        return { color: '#00ff44' };
    })();

    const pendingCost = committedActions.reduce((sum, act) => {
        const stats = ENTITY_STATS[act.itemType];
        return sum + (stats?.cost || 0);
    }, 0);
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
            handleClearActions={() => {
                audioManager.playActionReset();
                handleClearActions();
            }}
            handleExecuteTurn={() => {
                audioManager.playUplink();
                handleExecuteTurn();
            }}
            isLocked={isLocked}
            isResolvingUI={isResolvingUI}
            isSpectator={isSpectator}
            isUnassigned={isUnassigned}
        />
    );

    const playerColor = currentView === 'SANDBOX'
        ? (activeSandboxPlayer === 'player1' ? 'hsl(0, 85%, 60%)' : 'hsl(60, 85%, 60%)')
        : (pBase?.color || '#00ff44');
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

                const k = (n) => (n + h / 30) % 12;
                const a = s * Math.min(l, 1 - l);
                const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

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
                const k = (n) => (n + h / 30) % 12;
                const a = s * Math.min(l, 1 - l);
                const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
                const r = Math.round(255 * f(0));
                const g = Math.round(255 * f(8));
                const b = Math.round(255 * f(4));
                document.documentElement.style.setProperty(
                    '--player-accent-color-rgb',
                    `${r}, ${g}, ${b}`
                );
            }
        } else {
            // Hex fallback green rgb (0, 255, 68)
            document.documentElement.style.setProperty('--player-accent-color-rgb', '0, 255, 68');
        }
    }, [playerColor, crtColor]);

    const renderContent = () => {
        if (currentView === 'DESIGNER') {
            return <MapDesigner onSave={handleMapSave} onBack={() => setCurrentView('LOBBY')} />;
        }

        if (currentView === 'SANDBOX') {
            const pCurrentSandbox = {
                color: activeSandboxPlayer === 'player1' ? 'hsl(0, 85%, 60%)' : 'hsl(60, 85%, 60%)',
                energy: 9999 - sandboxActions.filter(a => a.playerId === activeSandboxPlayer).reduce((sum, act) => {
                    const stats = ENTITY_STATS[act.itemType];
                    return sum + (stats?.cost || 0);
                }, 0)
            };

            const sidebarLeftSandbox = (
                <SidebarLeft
                    myPlayerId={activeSandboxPlayer}
                    pCurrent={pCurrentSandbox}
                    playerState={sandboxState}
                    isSpectator={false}
                    selectedHubId={selectedHubId}
                />
            );

            const sidebarRightSandbox = (
                <SidebarRight
                    syncStatus={{ lockedIn: { player1: false, player2: false } }}
                    playerState={sandboxState}
                    timeRemaining={null}
                    showDebugPreview={showDebugPreview}
                    cameraOffset={cameraOffset}
                    zoom={zoom}
                    committedActions={sandboxActions.filter(a => a.playerId === activeSandboxPlayer)}
                    interactionBlocked={isSandboxResolving}
                    handleClearActions={() => {
                        audioManager.playActionReset();
                        setSandboxActions(prev => prev.filter(a => a.playerId !== activeSandboxPlayer));
                    }}
                    handleExecuteTurn={handleExecuteSandboxTurn}
                    isLocked={false}
                    isResolvingUI={isSandboxResolving}
                    isSpectator={false}
                    isUnassigned={false}
                />
            );

            return (
                <>
                    {sidebarLeftSandbox}

                    <div className="viewport-crt-container sandbox-active" ref={viewportRef}>
                        <div className="sandbox-header">
                            <span>PRACTICE RANGE | ACTIVE PILOT:</span>
                            <button
                                style={{
                                    background: activeSandboxPlayer === 'player1' ? 'hsl(0, 85%, 60%)' : '#222',
                                    color: activeSandboxPlayer === 'player1' ? '#000' : '#888',
                                    border: '1px solid #444',
                                    padding: '4px 12px',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold'
                                }}
                                onClick={() => {
                                    audioManager.playClick();
                                    setActiveSandboxPlayer('player1');
                                }}
                            >
                                PLAYER 1 (RED)
                            </button>
                            <button
                                style={{
                                    background: activeSandboxPlayer === 'player2' ? 'hsl(60, 85%, 60%)' : '#222',
                                    color: activeSandboxPlayer === 'player2' ? '#000' : '#888',
                                    border: '1px solid #444',
                                    padding: '4px 12px',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold'
                                }}
                                onClick={() => {
                                    audioManager.playClick();
                                    setActiveSandboxPlayer('player2');
                                }}
                            >
                                PLAYER 2 (YELLOW)
                            </button>
                            <button
                                className="exit-btn"
                                style={{
                                    background: '#552222',
                                    color: '#fff',
                                    border: '1px solid #883333',
                                    marginLeft: 'auto',
                                    padding: '4px 12px',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold'
                                }}
                                onClick={() => {
                                    audioManager.playActionReset();
                                    setCurrentView('LOBBY');
                                }}
                            >
                                EXIT RANGE
                            </button>
                        </div>
                        <div className="crt-scanlines-pixel-perfect" />
                        <main className={`game-world ${isSandboxResolving ? 'locked-out' : ''}`}>
                            <GameBoard
                                ref={gameBoardRef}
                                gameState={sandboxState}
                                myPlayerId={activeSandboxPlayer}
                                isSandbox={true}
                                selectedHubId={selectedHubId}
                                selectedItemType={selectedItemType}
                                launchMode={launchMode}
                                isAiming={isAiming}
                                committedActions={sandboxActions.filter(a => a.playerId === activeSandboxPlayer)}
                                showDebugPreview={showDebugPreview}
                                maxPullDistance={MAX_PULL_DISTANCE}
                                isResolving={isSandboxResolving}
                                cameraOffset={cameraOffset}
                                setCameraOffset={setCameraOffset}
                                zoom={zoom}
                                setZoom={setZoom}
                                minZoom={minZoom}
                                onSelectHub={(id) => setSelectedHubId(id)}
                                onAimStart={handleSandboxAimStart}
                                onAimUpdate={() => {}}
                                onAimEnd={(x, y) => {
                                    if (!isAiming) return;
                                    setIsAiming(false);
                                    const hub = sandboxState.entities.find((e) => e.id === selectedHubId);
                                    if (!hub) return;

                                    const { dx, dy } = GameState.getToroidalVector(
                                        hub.x,
                                        hub.y,
                                        x,
                                        y,
                                        sandboxState.map.width,
                                        sandboxState.map.height
                                    );
                                    let distance = Math.sqrt(dx * dx + dy * dy);
                                    if (distance > MAX_PULL_DISTANCE) distance = MAX_PULL_DISTANCE;
                                    const angle = GameState.calculateLaunchAngle(dx, dy);

                                    const launchDistance = GameState.calculateLaunchDistance(distance);
                                    const rad = (angle * Math.PI) / 180;
                                    const targetX = (hub.x + Math.cos(rad) * launchDistance + sandboxState.map.width) % sandboxState.map.width;
                                    const targetY = (hub.y + Math.sin(rad) * launchDistance + sandboxState.map.height) % sandboxState.map.height;

                                    const isInvalid = GameState.checkLinkAngleSeparation(
                                        selectedItemType,
                                        selectedHubId,
                                        targetX,
                                        targetY,
                                        sandboxState.links,
                                        sandboxActions,
                                        sandboxState.entities,
                                        sandboxState.map
                                    );

                                    if (isInvalid) {
                                        audioManager.playActionReset();
                                        setGlitchActive(true);
                                        setTimeout(() => setGlitchActive(false), 400);
                                        setLaunchMode(false);
                                        setSelectedHubId(null);
                                        return;
                                    }

                                    const action = {
                                        playerId: activeSandboxPlayer,
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

                                    setSandboxActions((prev) => [...prev, action]);
                                    setLaunchMode(false);
                                    setSelectedHubId(null);
                                }}
                            />
                            {selectedHubId &&
                                !launchMode &&
                                !isSandboxResolving &&
                                (() => {
                                    const hub = sandboxState.entities.find((e) => e.id === selectedHubId);
                                    if (!hub) return null;
                                    return (
                                        <RadialMenu
                                            x={hubScreenPos?.x || 0}
                                            y={hubScreenPos?.y || 0}
                                            playerEnergy={9999}
                                            hubFuel={
                                                hub.fuel !== undefined
                                                    ? hub.fuel - sandboxActions.filter(a => a.sourceId === selectedHubId).length
                                                    : 99
                                            }
                                            onSelect={(type) => {
                                                setSelectedItemType(type);
                                                setLaunchMode(true);
                                            }}
                                            onCancel={() => setSelectedHubId(null)}
                                        />
                                    );
                                })()}
                        </main>
                    </div>

                    {sidebarRightSandbox}
                </>
            );
        }

        if (!matchStarted) {
            if (currentRoomId === null) {
                return (
                    <RoomBrowser
                        rooms={roomsList}
                        onCreateRoom={createRoom}
                        onJoinRoom={joinRoom}
                        onOpenDesigner={() => setCurrentView('DESIGNER')}
                        onOpenSandbox={handleOpenSandbox}
                    />
                );
            }
            return (
                <LobbyOverlay
                    lobbyUpdate={lobbyStatus}
                    availableMaps={availableMaps}
                    onClaimSeat={triggerClaimSeat}
                    onReadyToggle={triggerReadyToggle}
                    onSetMap={triggerSetMap}
                    onOpenDesigner={() => setCurrentView('DESIGNER')}
                    onOpenSandbox={handleOpenSandbox}
                    onSetTeam={triggerSetTeam}
                    onMapDelete={handleMapDelete}
                    socketId={socket.id}
                    socket={socket}
                    onLeaveRoom={leaveRoom}
                    lastError={lastError}
                    setLastError={setLastError}
                />
            );
        }

        if (!playerState || !myPlayerId) {
            return (
                <>
                    {sidebarLeft}
                    <div className="viewport-crt-container">
                        <div className="loading-screen" style={{ minHeight: '300px' }}>
                            <p>
                                {!playerState
                                    ? 'Downloading Sector Data...'
                                    : 'Authenticating Pilot...'}
                            </p>
                            <div className="status-indicator">
                                Socket: {isConnected ? 'Online' : 'Offline'} | ID:{' '}
                                {myPlayerId || 'Pending'}
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
                    <main
                        className={`game-world ${isResolvingUI ? 'locked-out' : ''} ${glitchActive ? 'glitch-rejection' : ''}`}
                    >
                        {!isResolvingUI &&
                            !committedActions.length &&
                            selectedHubId &&
                            launchMode && (
                                <div className="hint-overlay">
                                    Drag from your selected Hub to launch
                                </div>
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
                            onAimUpdate={() => {}}
                            onAimEnd={handleAimEnd}
                        />

                        {selectedHubId &&
                            !launchMode &&
                            !interactionBlocked &&
                            playerState &&
                            (() => {
                                const hub = playerState.entities.find(
                                    (e) => e.id === selectedHubId
                                );
                                if (!hub) {
                                    console.log(
                                        'RadialMenu check: Hub not found for ID',
                                        selectedHubId
                                    );
                                    return null;
                                }

                                return (
                                    <RadialMenu
                                        x={hubScreenPos?.x || 0}
                                        y={hubScreenPos?.y || 0}
                                        playerEnergy={pCurrent.energy}
                                        hubFuel={
                                            hub.fuel !== undefined
                                                ? hub.fuel -
                                                  committedActions.filter(
                                                      (a) => a.sourceId === selectedHubId
                                                  ).length
                                                : 99
                                        }
                                        onSelect={(type) => {
                                            setSelectedItemType(type);
                                            setLaunchMode(true);
                                        }}
                                        onCancel={() => setSelectedHubId(null)}
                                    />
                                );
                            })()}

                        {launchMode && !isResolvingUI && (
                            <div className="hint-overlay">
                                Pull back from the Hub to Aim & Launch!
                            </div>
                        )}
                    </main>

                    {playerState.winner && (
                        <div className="winner-overlay">
                            <div
                                className="winner-card"
                                style={{
                                    borderColor: (() => {
                                        if (playerState.players[playerState.winner]) {
                                            return playerState.players[playerState.winner].color;
                                        }
                                        const member = Object.keys(playerState.players).find(
                                            (pid) => playerState.players[pid].team === playerState.winner
                                        );
                                        return member ? playerState.players[member].color : '#00f3ff';
                                    })()
                                }}
                            >
                                <h2>
                                    {playerState.winner === 'DRAW' ? "It's a Draw!" : 'Victory!'}
                                </h2>
                                <p>
                                    {playerState.winner === 'DRAW'
                                        ? 'Mutual destruction on Titan.'
                                        : playerState.winner.startsWith('Team')
                                        ? `${playerState.winner} has conquered the sector.`
                                        : `${playerState.players[playerState.winner]?.name || playerState.winner} has conquered the sector.`}
                                </p>
                                <button className="restart-btn" onClick={triggerRestart}>
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
            <ChatPanel
                messages={chatMessages}
                onSendMessage={handleSendMessage}
                isOpen={isChatOpen}
                onToggle={handleToggleChat}
                unreadCount={unreadCount}
            />
        </div>
    );
}

export default App;
