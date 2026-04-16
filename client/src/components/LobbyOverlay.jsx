import React from 'react';
import './LobbyOverlay.css';

export const LobbyOverlay = ({ lobbyUpdate, onClaimSeat, onReadyToggle, socketId }) => {
    if (!lobbyUpdate) return null;

    const mySeat = lobbyUpdate.slots.find(s => s && s.socketId === socketId);
    const mySeatIndex = lobbyUpdate.slots.findIndex(s => s && s.socketId === socketId);

    return (
        <div className="lobby-overlay">
            <div className="lobby-content">
                <h1 className="lobby-title">TITAN: NEXUS</h1>
                <p>Waiting for players...</p>

                <div className="slots-container">
                    {lobbyUpdate.slots.map((slot, index) => (
                        <button
                            key={index}
                            className={`slot-button ${slot ? 'occupied' : ''} ${mySeatIndex === index ? 'my-seat' : ''}`}
                            onClick={() => !slot && onClaimSeat(index)}
                            disabled={!!slot && slot.socketId !== socketId}
                        >
                            <span>Player {index + 1}</span>
                            {slot ? (
                                <span className={`status-badge ${slot.ready ? 'ready' : ''}`}>
                                    {slot.ready ? 'READY' : 'CLAIMED'}
                                </span>
                            ) : (
                                <span className="status-badge">AVAILABLE</span>
                            )}
                        </button>
                    ))}
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
                        onClick={() => socket.emit('lobby:autoJoin')}
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

                <p style={{ marginTop: '1rem', opacity: 0.7, fontSize: '0.9rem' }}>
                    Match starts when both players are ready.
                </p>
            </div>
        </div>
    );
};
