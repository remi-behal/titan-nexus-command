import React, { useState, useEffect, useRef, useCallback } from 'react';
import GameBoard from './GameBoard';
import { ENTITY_STATS, GLOBAL_STATS, RESOURCE_NODE_STATS } from '../../../shared/constants/EntityStats.js';
import './MapDesigner.css';

const TOOLS = {
    SELECT: 'SELECT',
    RESOURCE_STANDARD: 'RESOURCE_STANDARD',
    RESOURCE_SUPER: 'RESOURCE_SUPER',
    LAKE: 'LAKE',
    MOUNTAIN: 'MOUNTAIN',
    PLAYER1_BASE: 'PLAYER1_BASE',
    PLAYER2_BASE: 'PLAYER2_BASE',
    DELETE: 'DELETE'
};

const MapDesigner = ({ onSave, onBack }) => {
    const [mapData, setMapData] = useState({
        width: GLOBAL_STATS.MAP_WIDTH,
        height: GLOBAL_STATS.MAP_HEIGHT,
        resources: [],
        lakes: [],
        mountains: [],
        playerBases: [
            { id: 'p1', x: 250, y: 500, owner: 'player1' },
            { id: 'p2', x: 750, y: 500, owner: 'player2' }
        ]
    });

    const [selectedTool, setSelectedTool] = useState(TOOLS.SELECT);
    const [selectedId, setSelectedId] = useState(null);
    const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
    const gameBoardRef = useRef(null);

    // Mock GameState for GameBoard to render
    const mockGameState = React.useMemo(() => ({
        turn: 1,
        players: {
            player1: { color: 'hsl(0, 70%, 50%)', energy: 100 },
            player2: { color: 'hsl(60, 70%, 50%)', energy: 100 }
        },
        map: {
            width: mapData.width,
            height: mapData.height,
            resources: mapData.resources,
            obstacles: [], // Added missing field
            lakes: mapData.lakes,
            mountains: mapData.mountains
        },
        entities: [
            ...mapData.playerBases.map(b => ({
                id: b.id,
                type: 'HUB',
                owner: b.owner,
                x: b.x,
                y: b.y,
                hp: ENTITY_STATS.HUB.hp,
                isStarter: true
            }))
        ],
        links: [],
        phase: 'PLANNING'
    }), [mapData]);

    const handleMapClick = (e) => {
        // Stop propagation to prevent GameBoard from panning if we are placing
        if (selectedTool !== TOOLS.SELECT) {
            e.stopPropagation();
        }

        const coords = gameBoardRef.current.getGameCoords(e);
        if (!coords) return;

        console.log(`[MapDesigner] Clicked at ${coords.x}, ${coords.y} with tool ${selectedTool}`);

        setMapData(prev => {
            const newState = { ...prev };
            if (selectedTool === TOOLS.RESOURCE_STANDARD) {
                newState.resources = [...prev.resources, {
                    id: `res_${Math.random().toString(36).substr(2, 9)}`,
                    x: coords.x,
                    y: coords.y,
                    ...RESOURCE_NODE_STATS.STANDARD
                }];
            } else if (selectedTool === TOOLS.RESOURCE_SUPER) {
                newState.resources = [...prev.resources, {
                    id: `res_${Math.random().toString(36).substr(2, 9)}`,
                    x: coords.x,
                    y: coords.y,
                    ...RESOURCE_NODE_STATS.SUPER
                }];
            } else if (selectedTool === TOOLS.LAKE) {
                newState.lakes = [...prev.lakes, {
                    id: `lake_${Math.random().toString(36).substr(2, 9)}`,
                    x: coords.x,
                    y: coords.y,
                    radius: 100
                }];
            } else if (selectedTool === TOOLS.MOUNTAIN) {
                newState.mountains = [...prev.mountains, {
                    id: `mtn_${Math.random().toString(36).substr(2, 9)}`,
                    x: coords.x,
                    y: coords.y,
                    radius: 100
                }];
            } else if (selectedTool === TOOLS.DELETE) {
                newState.resources = prev.resources.filter(r => dist(r, coords) > 30);
                newState.lakes = prev.lakes.filter(l => dist(l, coords) > l.radius);
                newState.mountains = prev.mountains.filter(m => dist(m, coords) > m.radius);
            } else if (selectedTool === TOOLS.PLAYER1_BASE) {
                newState.playerBases = prev.playerBases.map(b =>
                    b.owner === 'player1' ? { ...b, x: coords.x, y: coords.y } : b
                );
            } else if (selectedTool === TOOLS.PLAYER2_BASE) {
                newState.playerBases = prev.playerBases.map(b =>
                    b.owner === 'player2' ? { ...b, x: coords.x, y: coords.y } : b
                );
            }
            return newState;
        });
    };

    const dist = (p1, p2) => {
        let dx = Math.abs(p1.x - p2.x);
        let dy = Math.abs(p1.y - p2.y);
        if (dx > mapData.width / 2) dx = mapData.width - dx;
        if (dy > mapData.height / 2) dy = mapData.height - dy;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const handleExport = () => {
        const json = JSON.stringify(mapData, null, 2);
        navigator.clipboard.writeText(json);
        alert('Map JSON copied to clipboard!');
    };

    const handleSaveLocal = () => {
        onSave(mapData);
    };

    return (
        <div className="map-designer">
            <div className="designer-toolbar">
                <button
                    className={selectedTool === TOOLS.SELECT ? 'active' : ''}
                    onClick={() => setSelectedTool(TOOLS.SELECT)}
                >Select/Move</button>
                <button
                    className={selectedTool === TOOLS.RESOURCE_STANDARD ? 'active' : ''}
                    onClick={() => setSelectedTool(TOOLS.RESOURCE_STANDARD)}
                >+ Resource</button>
                <button
                    className={selectedTool === TOOLS.RESOURCE_SUPER ? 'active' : ''}
                    onClick={() => setSelectedTool(TOOLS.RESOURCE_SUPER)}
                >+ Super Res</button>
                <button
                    className={selectedTool === TOOLS.LAKE ? 'active' : ''}
                    onClick={() => setSelectedTool(TOOLS.LAKE)}
                >+ Lake</button>
                <button
                    className={selectedTool === TOOLS.MOUNTAIN ? 'active' : ''}
                    onClick={() => setSelectedTool(TOOLS.MOUNTAIN)}
                >+ Mountain</button>
                <button
                    className={selectedTool === TOOLS.PLAYER1_BASE ? 'active' : ''}
                    onClick={() => setSelectedTool(TOOLS.PLAYER1_BASE)}
                >P1 Base</button>
                <button
                    className={selectedTool === TOOLS.PLAYER2_BASE ? 'active' : ''}
                    onClick={() => setSelectedTool(TOOLS.PLAYER2_BASE)}
                >P2 Base</button>
                <button
                    className={selectedTool === TOOLS.DELETE ? 'active' : ''}
                    onClick={() => setSelectedTool(TOOLS.DELETE)}
                >Delete</button>
                <div className="spacer"></div>
                <button onClick={handleExport}>Copy JSON</button>
                <button onClick={handleSaveLocal}>Save Map</button>
                <button onClick={onBack}>Back to Lobby</button>
            </div>

            <main className="designer-world">
                <GameBoard
                    ref={gameBoardRef}
                    gameState={mockGameState}
                    myPlayerId="spectator"
                    selectedHubId={null}
                    launchMode={false}
                    isAiming={false}
                    committedActions={[]}
                    showDebugPreview={false}
                    cameraOffset={cameraOffset}
                    setCameraOffset={setCameraOffset}
                    onSelectHub={() => { }}
                    onAimStart={() => { }}
                    onAimUpdate={() => { }}
                    onAimEnd={() => { }}
                />
                {selectedTool !== TOOLS.SELECT && (
                    <div
                        className="designer-click-overlay"
                        onMouseDown={handleMapClick}
                    />
                )}
            </main>
        </div>
    );
};

export default MapDesigner;
