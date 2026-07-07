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
                                <h3>☄️ HOW TO LAUNCH</h3>
                                <p>To launch, select any of your active Hubs, click and drag (pull back) in the opposite direction of your target, then release to open the radial menu and select a structure or weapon. The drag distance controls launch velocity and range, and the angle controls the trajectory path.</p>
                            </div>
                            <div className="help-section">
                                <h3>🔄 TURNS VS. ROUNDS</h3>
                                <p>Titan: Nexus Command features a structured turn lifecycle:</p>
                                <ul style={{ paddingLeft: '20px', margin: '5px 0 0 0', fontSize: '0.9rem', lineHeight: '1.4' }}>
                                    <li><strong>Planning Phase (Turn):</strong> Both players simultaneously plan, aim, and commit their launches. Initiating a launch costs Energy and 1 Hub Fuel.</li>
                                    <li><strong>Resolution Phase (Rounds):</strong> All planned actions are simulated sequentially across multiple <strong>Rounds of launches</strong> (Round 1, Round 2, Round 3, etc.).</li>
                                    <li><strong>One Launch Per Hub Per Round:</strong> Each Hub can only execute one action per round. If you queue multiple launches from the same Hub, they are resolved sequentially over consecutive rounds. Hubs can fire simultaneously if they are different structures. Active defenses can also perform one interception per round.</li>
                                </ul>
                            </div>
                            <div className="help-section">
                                <h3>🏗️ STRUCTURES</h3>
                                <ul style={{ paddingLeft: '20px', margin: '5px 0 0 0', fontSize: '0.9rem', lineHeight: '1.4' }}>
                                    <li><strong>Hub (Cost: 20):</strong> The foundation of your network. Launches structures/weapons and forms links back to the Starter Hub.</li>
                                    <li><strong>Extractor (Cost: 25):</strong> Generates +5 Energy per turn to fund constructions and weapon payloads.</li>
                                    <li><strong>Shield (Cost: 45):</strong> Creates a protective energy dome that absorbs damage for structures inside its radius.</li>
                                    <li><strong>Cloaking Field (Cost: 60):</strong> Conceals nearby friendly structures from enemy sensors and vision.</li>
                                    <li><strong>Laser Point Defense (L.P.D.) (Cost: 25):</strong> Emits an instant laser that intercepts a single incoming projectile per round.</li>
                                    <li><strong>Light SAM Defense (Cost: 25):</strong> Fires standard homing missiles to intercept incoming enemy threats.</li>
                                    <li><strong>Smart SAM Defense (Cost: 40):</strong> Fires advanced interceptor missiles with a longer range and tracking capability.</li>
                                    <li><strong>Flak Defense (Cost: 25):</strong> Sets up a persistent 90° zone of flak that damages all crossing units.</li>
                                    <li><strong>Echo Artillery (Cost: 30):</strong> Monitors enemy launches and fires automatic retaliation shots in the next round.</li>
                                </ul>
                            </div>
                            <div className="help-section">
                                <h3>💣 WEAPONS & UTILITIES</h3>
                                <ul style={{ paddingLeft: '20px', margin: '5px 0 0 0', fontSize: '0.9rem', lineHeight: '1.4' }}>
                                    <li><strong>Dumb Bomb (Cost: 15):</strong> A standard gravity-affected explosive shell dealing moderate landing damage.</li>
                                    <li><strong>Cluster Bomb (Cost: 30):</strong> Splits mid-flight to drop three sub-bombs in a wide line perpendicular to travel.</li>
                                    <li><strong>Homing Missile (Cost: 20):</strong> Automatically targets and accelerates toward the nearest detected enemy structure.</li>
                                    <li><strong>Napalm (Cost: 35):</strong> Releases a canister creating a lingering line of fire that deals damage over 2 rounds.</li>
                                    <li><strong>EMP (Cost: 50):</strong> Emits a non-damaging pulse that disables enemy shields and active defenses.</li>
                                    <li><strong>Overload (Cost: 40):</strong> Targets and overloads active energy grids to deal system damage.</li>
                                    <li><strong>Reclaimer (Cost: 0, Fuel: 1):</strong> Safely recycles friendly structures within its radius, returning 50% of the cost.</li>
                                    <li><strong>Nuke (Cost: 100):</strong> A slow-moving, high-yield warhead that detonates, leaving a massive, long-lasting hazard zone.</li>
                                </ul>
                            </div>
                            <div className="help-section">
                                <h3>⚡ ENERGY & ⛽ FUEL</h3>
                                <p>Energy is your construction currency, generated by Extractors. Each launch consumes 1 Hub Fuel point per turn. Hub Fuel fully regenerates at the start of each new turn.</p>
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
