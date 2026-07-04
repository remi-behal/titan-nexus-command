import React, { useState } from 'react';
import './LobbyOverlay.css';

export const LobbyOverlay = ({
    lobbyUpdate,
    availableMaps,
    onClaimSeat,
    onReadyToggle,
    onSetMap,
    onOpenDesigner,
    onOpenSandbox,
    onSetTeam,
    onMapDelete,
    socketId,
    socket,
    onLeaveRoom,
    lastError,
    setLastError
}) => {
    const [showNameModal, setShowNameModal] = useState(false);
    const [targetSeatIndex, setTargetSeatIndex] = useState(null);
    const [nameInput, setNameInput] = useState('');

    if (!lobbyUpdate) return null;

    const mySeat = lobbyUpdate.slots.find((s) => s && s.socketId === socketId);
    const mySeatIndex = lobbyUpdate.slots.findIndex((s) => s && s.socketId === socketId);

    const handleConfirmName = () => {
        if (targetSeatIndex !== null && nameInput.trim()) {
            localStorage.setItem('titan_nexus_player_name', nameInput.trim());
            onClaimSeat(targetSeatIndex, nameInput.trim());
            setShowNameModal(false);
            setTargetSeatIndex(null);
        }
    };

    const handleCancelName = () => {
        setShowNameModal(false);
        setTargetSeatIndex(null);
        if (setLastError) setLastError(null);
    };

    return (
        <div className="lobby-overlay">
            <div className="lobby-content">
                <h1 className="lobby-title">TITAN: {(lobbyUpdate.id || 'NEXUS').toUpperCase()}</h1>
                <p>Waiting for players...</p>

                {lastError && (
                    <div className="lobby-error-banner" onClick={() => setLastError && setLastError(null)}>
                        [SYSTEM ERROR]: {lastError} (Click to dismiss)
                    </div>
                )}

                {mySeatIndex === 0 && (
                    <div className="slot-adjust-controls" style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginBottom: '1.5rem' }}>
                        <button
                            className="adjust-slot-btn remove-slot-btn"
                            onClick={() => socket.emit('lobby:adjustSlots', { action: 'remove' })}
                            disabled={lobbyUpdate.slots.length <= 2}
                            style={{
                                padding: '0.6rem 1.2rem',
                                backgroundColor: '#962d2d',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                opacity: lobbyUpdate.slots.length <= 2 ? 0.5 : 1
                            }}
                        >
                            - REMOVE SLOT
                        </button>
                        <span style={{ alignSelf: 'center', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '1.1rem', letterSpacing: '1px' }}>
                            SLOTS: {lobbyUpdate.slots.length} / 8
                        </span>
                        <button
                            className="adjust-slot-btn add-slot-btn"
                            onClick={() => socket.emit('lobby:adjustSlots', { action: 'add' })}
                            disabled={lobbyUpdate.slots.length >= 8}
                            style={{
                                padding: '0.6rem 1.2rem',
                                backgroundColor: '#27ae60',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                opacity: lobbyUpdate.slots.length >= 8 ? 0.5 : 1
                            }}
                        >
                            + ADD SLOT
                        </button>
                    </div>
                )}

                <div className="slots-container">
                    {lobbyUpdate.slots.map((slot, index) => (
                        <div
                            key={index}
                            className={`slot-button slot-p${index + 1} ${slot ? 'occupied' : ''} ${mySeatIndex === index ? 'my-seat' : ''} ${slot?.ready ? 'is-ready' : ''}`}
                            onClick={() => {
                                if (!slot) {
                                    const savedName = localStorage.getItem('titan_nexus_player_name') || `Pilot_${Math.floor(Math.random() * 9000 + 1000)}`;
                                    onClaimSeat(index, savedName);
                                }
                            }}
                        >
                            <span>{slot ? (slot.playerName || `Player ${index + 1}`) : `Player ${index + 1}`}</span>
                            {slot ? (
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    {mySeatIndex === index ? (
                                        <select
                                            value={slot.team || 'Team A'}
                                            onChange={(e) => onSetTeam(e.target.value)}
                                            className="slot-team-select"
                                            onClick={(e) => e.stopPropagation()} // Prevent triggering seat claim click
                                        >
                                            <option value="Team A">Team A</option>
                                            <option value="Team B">Team B</option>
                                        </select>
                                    ) : (
                                        <span className="slot-team-badge">{slot.team || 'Team A'}</span>
                                    )}
                                    <span className={`status-badge ${slot.ready ? 'ready' : ''}`}>
                                        {slot.ready ? 'READY' : 'CLAIMED'}
                                    </span>
                                </div>
                            ) : (
                                <span className="status-badge">AVAILABLE</span>
                            )}
                        </div>
                    ))}
                </div>

                {lobbyUpdate.spectators && lobbyUpdate.spectators.length > 0 && (
                    <div className="spectators-section" style={{
                        marginTop: '1.5rem',
                        padding: '1rem',
                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid #333',
                        borderRadius: '6px',
                        textAlign: 'left'
                    }}>
                        <h3 style={{
                            margin: '0 0 0.5rem 0',
                            fontFamily: 'monospace',
                            fontSize: '1rem',
                            color: '#00e5ff',
                            letterSpacing: '1px'
                        }}>CONNECTED SPECTATORS / UNASSIGNED CREW</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                            {lobbyUpdate.spectators.map((spec) => (
                                <span key={spec.id} style={{
                                    fontFamily: 'monospace',
                                    fontSize: '0.9rem',
                                    color: '#ccc',
                                    backgroundColor: 'rgba(255, 255, 255, 0.07)',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    border: '1px solid #444'
                                }}>
                                    {spec.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}


                <div className="map-selection" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label>Battlefield:</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select
                            value={lobbyUpdate.selectedMapName || ''}
                            onChange={(e) => onSetMap(e.target.value || null)}
                            disabled={mySeatIndex !== 0}
                            className="map-select"
                            style={{ flexGrow: 1 }}
                        >
                            <option value="">Default Sector</option>
                            {availableMaps &&
                                availableMaps.map((map) => (
                                    <option key={map.id} value={map.id}>
                                        {map.isCustom ? `[Custom] ${map.name}` : map.name}
                                    </option>
                                ))}
                        </select>
                        {mySeatIndex === 0 && lobbyUpdate.selectedMapName && availableMaps.find(m => m.id === lobbyUpdate.selectedMapName)?.isCustom && (
                            <button
                                onClick={() => {
                                    if (confirm(`Are you sure you want to delete "${lobbyUpdate.selectedMapName}"?`)) {
                                        onMapDelete(lobbyUpdate.selectedMapName);
                                        onSetMap(null);
                                    }
                                }}
                                style={{
                                    backgroundColor: '#962d2d',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    fontFamily: 'monospace',
                                    fontWeight: 'bold'
                                }}
                            >
                                DELETE
                            </button>
                        )}
                    </div>
                    {mySeatIndex !== 0 && (
                        <p className="host-only-hint">Only Player 1 can select maps</p>
                    )}
                </div>

                {mySeatIndex !== -1 && (
                    <button
                        className={`ready-button ${mySeat?.ready ? 'is-ready' : ''}`}
                        onClick={() => onReadyToggle(!mySeat?.ready)}
                    >
                        {mySeat?.ready ? 'UNREADY' : 'I AM READY'}
                    </button>
                )}

                {new URLSearchParams(window.location.search).get('debug') === '1' && (
                    <button
                        className="quick-start-button"
                        onClick={() => socket.emit('lobby:autoJoin', { force: true })}
                        style={{
                            marginTop: '1rem',
                            padding: '0.5rem 1rem',
                            backgroundColor: '#3a3a3a',
                            color: '#fff',
                            border: '1px solid #555',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Quick Start (Debug)
                    </button>
                )}



                <button
                    className="leave-button"
                    onClick={onLeaveRoom}
                >
                    LEAVE SECTOR
                </button>

                <p style={{ marginTop: '1rem', opacity: 0.7, fontSize: '0.9rem' }}>
                    Match starts when both players are ready.
                </p>
            </div>

            {showNameModal && (
                <div className="name-modal-backdrop">
                    <div className="name-modal-content">
                        <h3 className="name-modal-title">SECURE COMMUNICATIONS</h3>
                        <p className="name-modal-prompt">Enter signature for slot #{targetSeatIndex + 1}:</p>
                        <input
                            type="text"
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            maxLength={15}
                            placeholder="COMM_HANDLE"
                            className="name-input-field"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleConfirmName();
                                if (e.key === 'Escape') handleCancelName();
                            }}
                        />
                        <div className="name-modal-buttons">
                            <button className="confirm-btn" onClick={handleConfirmName}>CONFIRM</button>
                            <button className="cancel-btn" onClick={handleCancelName}>CANCEL</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
