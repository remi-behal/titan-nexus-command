import React, { useState } from 'react';
import './RoomBrowser.css';

export const RoomBrowser = ({ rooms = [], onCreateRoom, onJoinRoom, onOpenDesigner, onOpenSandbox, onChangeName }) => {
    const [newRoomId, setNewRoomId] = useState('');
    const [error, setError] = useState('');
    const [showHelp, setShowHelp] = useState(false);
    const [playerName, setPlayerName] = useState(() => {
        let name = localStorage.getItem('titan_nexus_player_name');
        if (!name) {
            name = `Pilot_${Math.floor(Math.random() * 9000 + 1000)}`;
            localStorage.setItem('titan_nexus_player_name', name);
        }
        return name;
    });

    const handleCreate = (e) => {
        e.preventDefault();
        if (!newRoomId.trim()) {
            setError('Please enter a room name.');
            return;
        }
        if (newRoomId.length > 20) {
            setError('Room name must be 20 characters or less.');
            return;
        }
        setError('');
        onCreateRoom(newRoomId.trim());
        setNewRoomId('');
    };

    return (
        <div className="room-browser">
            <div className="browser-content">
                <h1 className="browser-title">TITAN: NEXUS COMMAND</h1>
                <p className="browser-subtitle">SECTOR DIRECTORY</p>

                <div className="player-name-section" style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ccc', fontFamily: 'monospace' }}>
                        PILOT IDENTITY: <span style={{ color: '#00e5ff', textShadow: '0 0 8px rgba(0,229,255,0.4)' }}>{playerName}</span>
                    </span>
                    <button
                        onClick={() => {
                            const newName = prompt('ENTER NEW PILOT IDENTITY:', playerName);
                            if (newName && newName.trim()) {
                                if (newName.trim().length > 15) {
                                    alert('Name must be 15 characters or less!');
                                    return;
                                }
                                const trimmed = newName.trim();
                                localStorage.setItem('titan_nexus_player_name', trimmed);
                                setPlayerName(trimmed);
                                if (onChangeName) {
                                    onChangeName(trimmed);
                                }
                            }
                        }}
                        className="change-name-button"
                        style={{
                            padding: '0.5rem 1.5rem',
                            backgroundColor: '#34495e',
                            color: '#fff',
                            border: '1px solid #00e5ff',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            letterSpacing: '1px',
                            fontFamily: 'inherit',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 0 5px rgba(0,229,255,0.2)'
                        }}
                    >
                        CHANGE SIGNATURE
                    </button>
                </div>

                <form onSubmit={handleCreate} className="create-room-form">
                    <input
                        type="text"
                        value={newRoomId}
                        onChange={(e) => setNewRoomId(e.target.value)}
                        placeholder="ENTER NEW SECTOR ID..."
                        className="create-room-input"
                    />
                    <button type="submit" className="create-room-button">
                        LAUNCH SECTOR
                    </button>
                </form>
                {error && <p className="error-message">{error}</p>}

                <div className="browser-modes">
                    <button
                        onClick={onOpenSandbox}
                        className="browser-mode-button sandbox-btn"
                        style={{
                            flex: 1,
                            padding: '0.8rem 1.5rem',
                            backgroundColor: '#27ae60',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            letterSpacing: '1px',
                            fontFamily: 'inherit'
                        }}
                    >
                        PRACTICE RANGE
                    </button>
                    <button
                        onClick={onOpenDesigner}
                        className="browser-mode-button designer-btn"
                        style={{
                            flex: 1,
                            padding: '0.8rem 1.5rem',
                            backgroundColor: '#2980b9',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            letterSpacing: '1px',
                            fontFamily: 'inherit'
                        }}
                    >
                        DESIGN CUSTOM MAP
                    </button>
                    <button
                        onClick={() => setShowHelp(true)}
                        className="browser-mode-button help-btn"
                        style={{
                            flex: 1,
                            padding: '0.8rem 1.5rem',
                            backgroundColor: '#8e44ad',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            letterSpacing: '1px',
                            fontFamily: 'inherit'
                        }}
                    >
                        HOW TO PLAY
                    </button>
                </div>

                <div className="rooms-grid">
                    {rooms.map((room) => (
                        <div key={room.id} className={`room-card ${room.status === 'IN_GAME' ? 'active-match' : ''}`}>
                            <div className="room-card-header">
                                <span className="room-id">{room.id.toUpperCase()}</span>
                                <span className={`room-status-badge ${room.status === 'IN_GAME' ? 'in-game' : 'lobby'}`}>
                                    {room.status === 'IN_GAME' ? 'IN ORBIT' : 'PREPARING'}
                                </span>
                            </div>
                            <div className="room-card-body">
                                <span className="room-players">
                                    {room.playerCount} / {room.maxPlayers} CREW
                                </span>
                            </div>
                            <button
                                onClick={() => onJoinRoom(room.id)}
                                className="join-room-button"
                            >
                                {room.status === 'IN_GAME' ? 'SPECTATE' : 'DOCK'}
                            </button>
                        </div>
                    ))}
                    {rooms.length === 0 && (
                        <div className="no-rooms-card">
                            <span>NO ACTIVE SECTORS DETECTED</span>
                        </div>
                    )}
                </div>
            </div>

            {showHelp && (
                <div className="help-modal-overlay" onClick={() => setShowHelp(false)}>
                    <div className="help-modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="help-modal-close" onClick={() => setShowHelp(false)}>×</button>
                        <h2 className="help-modal-title">MISSION BRIEFING: HOW TO PLAY</h2>
                        <div className="help-modal-body">
                            <div className="help-section">
                                <h3>🪐 MAIN OBJECTIVE</h3>
                                <p>Destroy the <strong>Starter Hub</strong> of all opponent pilots to claim dominance in the sector. If your Starter Hub is destroyed, all your structures will decay and you will be eliminated.</p>
                            </div>
                            <div className="help-section">
                                <h3>☄️ SLINGSHOT MECHANIC</h3>
                                <p>Launch structures or projectiles from any of your active Hubs by dragging/pulling back from the Hub in the opposite direction. Trajectory and launch velocity depend on the drag distance and angle.</p>
                            </div>
                            <div className="help-section">
                                <h3>⚡ ENERGY</h3>
                                <p>Energy is your primary construction currency. It is generated passively or at a higher rate by deploying <strong>Extractors</strong>. Use energy to construct new structures or launch weapon payloads.</p>
                            </div>
                            <div className="help-section">
                                <h3>⛽ FUEL</h3>
                                <p>Each Hub or defense structure has limited fuel per turn (represented by green dots). Initiating any launch consumes 1 fuel point. Fuel fully regenerates at the start of each round.</p>
                            </div>
                            <div className="help-section">
                                <h3>🔗 LINKS & DECAY</h3>
                                <p>All active structures must maintain a continuous link network back to your Starter Hub. Sinking in Liquid Methane Lakes, crossing enemy links, or getting disconnected will sever links, causing structures to suffer <strong>Link Decay</strong> and disintegrate at the end of the turn.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
