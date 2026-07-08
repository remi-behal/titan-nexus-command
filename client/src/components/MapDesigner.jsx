import React, { useState, useRef } from 'react';
import GameBoard from './GameBoard';
import {
    ENTITY_STATS,
    GLOBAL_STATS,
    RESOURCE_NODE_STATS
} from '../../../shared/constants/EntityStats.js';
import './MapDesigner.css';

const TOOLS = {
    SELECT: 'SELECT',
    RESOURCE_STANDARD: 'RESOURCE_STANDARD',
    RESOURCE_SUPER: 'RESOURCE_SUPER',
    LAKE: 'LAKE',
    MOUNTAIN: 'MOUNTAIN',
    STARTER_HUB_ADD: 'STARTER_HUB_ADD',
    MOVE_HUB_1: 'MOVE_HUB_1',
    MOVE_HUB_2: 'MOVE_HUB_2',
    MOVE_HUB_3: 'MOVE_HUB_3',
    MOVE_HUB_4: 'MOVE_HUB_4',
    MOVE_HUB_5: 'MOVE_HUB_5',
    MOVE_HUB_6: 'MOVE_HUB_6',
    MOVE_HUB_7: 'MOVE_HUB_7',
    MOVE_HUB_8: 'MOVE_HUB_8',
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
    const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(0.8);
    const [minZoom] = useState(0.25);
    const gameBoardRef = useRef(null);
    const [, setRefTick] = useState(0);
    const setGameBoardRef = React.useCallback((node) => {
        const prev = gameBoardRef.current;
        gameBoardRef.current = node;
        if ((!prev && node) || (prev && !node)) {
            setRefTick((t) => t + 1);
        }
    }, []);

    // Mock GameState for GameBoard to render
    const mockGameState = React.useMemo(
        () => ({
            turn: 1,
            players: mapData.playerBases.reduce((acc, b, index) => {
                acc[b.owner] = {
                    color: index === 0 ? 'hsl(0, 100%, 68%)' : `hsl(${index * 60}, 85%, 60%)`,
                    energy: 100
                };
                return acc;
            }, {}),
            map: {
                width: mapData.width,
                height: mapData.height,
                resources: mapData.resources,
                obstacles: [], // Added missing field
                lakes: mapData.lakes,
                mountains: mapData.mountains
            },
            entities: [
                ...mapData.playerBases.map((b) => ({
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
        }),
        [mapData]
    );

    const handleMapClick = (e) => {
        if (selectedTool === TOOLS.SELECT) return;

        if (!gameBoardRef.current) return;
        const coords = gameBoardRef.current.getGameCoords(e);
        if (!coords) return;

        console.log(`[MapDesigner] Clicked at ${coords.x}, ${coords.y} with tool ${selectedTool}`);

        setMapData((prev) => {
            const newState = { ...prev };
            if (selectedTool === TOOLS.RESOURCE_STANDARD) {
                newState.resources = [
                    ...prev.resources,
                    {
                        id: `res_${Math.random().toString(36).substr(2, 9)}`,
                        x: coords.x,
                        y: coords.y,
                        ...RESOURCE_NODE_STATS.STANDARD
                    }
                ];
            } else if (selectedTool === TOOLS.RESOURCE_SUPER) {
                newState.resources = [
                    ...prev.resources,
                    {
                        id: `res_${Math.random().toString(36).substr(2, 9)}`,
                        x: coords.x,
                        y: coords.y,
                        ...RESOURCE_NODE_STATS.SUPER
                    }
                ];
            } else if (selectedTool === TOOLS.LAKE) {
                newState.lakes = [
                    ...prev.lakes,
                    {
                        id: `lake_${Math.random().toString(36).substr(2, 9)}`,
                        x: coords.x,
                        y: coords.y,
                        radius: 100
                    }
                ];
            } else if (selectedTool === TOOLS.MOUNTAIN) {
                newState.mountains = [
                    ...prev.mountains,
                    {
                        id: `mtn_${Math.random().toString(36).substr(2, 9)}`,
                        x: coords.x,
                        y: coords.y,
                        radius: 100
                    }
                ];
            } else if (selectedTool === TOOLS.DELETE) {
                newState.resources = prev.resources.filter((r) => dist(r, coords) > 30);
                newState.lakes = prev.lakes.filter((l) => dist(l, coords) > l.radius);
                newState.mountains = prev.mountains.filter((m) => dist(m, coords) > m.radius);
                const remainingBases = prev.playerBases.filter((b) => dist(b, coords) > 30);
                newState.playerBases = remainingBases.map((b, idx) => ({
                    ...b,
                    id: `p${idx + 1}`,
                    owner: `player${idx + 1}`
                }));
                if (selectedTool.startsWith('MOVE_HUB_')) {
                    const hubIdx = parseInt(selectedTool.replace('MOVE_HUB_', ''), 10) - 1;
                    if (hubIdx >= newState.playerBases.length) {
                        setSelectedTool(TOOLS.SELECT);
                    }
                }
            } else if (selectedTool === TOOLS.STARTER_HUB_ADD) {
                if (prev.playerBases.length < 8) {
                    const nextNum = prev.playerBases.length + 1;
                    newState.playerBases = [
                        ...prev.playerBases,
                        {
                            id: `p${nextNum}`,
                            x: coords.x,
                            y: coords.y,
                            owner: `player${nextNum}`
                        }
                    ];
                } else {
                    alert("Maximum of 8 starter hubs reached.");
                }
            } else if (selectedTool.startsWith('MOVE_HUB_')) {
                const hubIdx = parseInt(selectedTool.replace('MOVE_HUB_', ''), 10) - 1;
                if (newState.playerBases[hubIdx]) {
                    newState.playerBases = prev.playerBases.map((b, idx) =>
                        idx === hubIdx ? { ...b, x: coords.x, y: coords.y } : b
                    );
                }
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
                <div className="toolbar-section">
                    <span className="section-label">Tools</span>
                    <div className="button-group">
                        <button
                            className={selectedTool === TOOLS.SELECT ? 'active' : ''}
                            onClick={() => setSelectedTool(TOOLS.SELECT)}
                        >
                            Select/Move
                        </button>
                        <button
                            className={selectedTool === TOOLS.RESOURCE_STANDARD ? 'active' : ''}
                            onClick={() => setSelectedTool(TOOLS.RESOURCE_STANDARD)}
                        >
                            + Resource
                        </button>
                        <button
                            className={selectedTool === TOOLS.RESOURCE_SUPER ? 'active' : ''}
                            onClick={() => setSelectedTool(TOOLS.RESOURCE_SUPER)}
                        >
                            + Super Res
                        </button>
                        <button
                            className={selectedTool === TOOLS.LAKE ? 'active' : ''}
                            onClick={() => setSelectedTool(TOOLS.LAKE)}
                        >
                            + Lake
                        </button>
                        <button
                            className={selectedTool === TOOLS.MOUNTAIN ? 'active' : ''}
                            onClick={() => setSelectedTool(TOOLS.MOUNTAIN)}
                        >
                            + Mountain
                        </button>
                        {mapData.playerBases.length < 8 && (
                            <button
                                className={selectedTool === TOOLS.STARTER_HUB_ADD ? 'active' : ''}
                                onClick={() => setSelectedTool(TOOLS.STARTER_HUB_ADD)}
                            >
                                + Hub
                            </button>
                        )}
                        {mapData.playerBases.map((b, idx) => {
                            const toolKey = `MOVE_HUB_${idx + 1}`;
                            return (
                                <button
                                    key={toolKey}
                                    className={selectedTool === toolKey ? 'active' : ''}
                                    onClick={() => setSelectedTool(toolKey)}
                                >
                                    Move H{idx + 1}
                                </button>
                            );
                        })}
                        <button
                            className={selectedTool === TOOLS.DELETE ? 'active' : ''}
                            onClick={() => setSelectedTool(TOOLS.DELETE)}
                        >
                            Delete
                        </button>
                    </div>
                </div>
                <div className="designer-toolbar-spacer"></div>
                <div className="toolbar-section">
                    <span className="section-label">Actions</span>
                    <div className="button-group">
                        <button onClick={handleExport}>Copy JSON</button>
                        <button onClick={handleSaveLocal}>Save Map</button>
                        <button className="btn-exit" onClick={onBack}>Exit</button>
                    </div>
                </div>
            </div>

            <main className="designer-world">
                <GameBoard
                    ref={setGameBoardRef}
                    gameState={mockGameState}
                    myPlayerId="spectator"
                    selectedHubId={null}
                    launchMode={false}
                    isAiming={false}
                    committedActions={[]}
                    showDebugPreview={false}
                    cameraOffset={cameraOffset}
                    setCameraOffset={setCameraOffset}
                    zoom={zoom}
                    setZoom={setZoom}
                    minZoom={minZoom}
                    isSandbox={true}
                    onSelectHub={() => {}}
                    onAimStart={() => {}}
                    onAimUpdate={() => {}}
                    onAimEnd={() => {}}
                    onMapClick={handleMapClick}
                />
            </main>
        </div>
    );
};

export default MapDesigner;
