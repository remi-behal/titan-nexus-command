import React, { useState } from 'react';
import './RoomBrowser.css';

export const RoomBrowser = ({ rooms, onCreateRoom, onJoinRoom }) => {
    const [newRoomId, setNewRoomId] = useState('');
    const [error, setError] = useState('');

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
        </div>
    );
};
