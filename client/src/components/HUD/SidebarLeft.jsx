import React from 'react';
import { ENTITY_STATS, GLOBAL_STATS } from '../../../../shared/constants/EntityStats.js';
import { TRACKS } from '../../utils/AudioManager';

/**
 * SidebarLeft component handles the left HUD panel, containing player details,
 * energy income forecasts, and retro chiptune media controls.
 */
export default function SidebarLeft({
    myPlayerId,
    pCurrent,
    playerState,
    isSpectator,
    selectedHubId,
    audioVolume,
    audioMuted,
    currentTrackPath,
    audioPlaying,
    audioShuffle,
    handleVolumeChange,
    handleMuteToggle,
    handlePlayPauseToggle,
    handlePrevTrack,
    handleNextTrack,
    handleShuffleToggle,
    handleTrackChange
}) {
    return (
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

            <div className="audio-panel">
                <div className="panel-title">COMM AUDIO</div>
                <div className="audio-controls">
                    <button 
                        className={`mute-btn ${audioMuted ? 'muted' : ''}`} 
                        onClick={handleMuteToggle}
                        title={audioMuted ? "Unmute Audio" : "Mute Audio"}
                    >
                        {audioMuted ? "OFF" : "ON"}
                    </button>
                    <div className="slider-container">
                        <span className="slider-label">VOL:</span>
                        <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.05" 
                            value={audioVolume} 
                            onChange={handleVolumeChange}
                            className="retro-slider"
                            disabled={audioMuted}
                        />
                    </div>
                </div>
                <div className="track-selector-container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                        <span className="slider-label" style={{ fontSize: '0.55rem', color: '#666', letterSpacing: '1px' }}>TRACK:</span>
                        <span className="status-label" style={{ 
                            fontSize: '0.55rem', 
                            color: audioPlaying ? 'var(--player-accent-color, #00ff44)' : '#666', 
                            fontFamily: 'monospace',
                            fontWeight: 'bold',
                            letterSpacing: '1px'
                        }}>
                            {audioPlaying ? '[PLAYING]' : '[PAUSED]'}
                        </span>
                    </div>
                    <select 
                        value={currentTrackPath} 
                        onChange={(e) => handleTrackChange(e.target.value)}
                        className="retro-select"
                    >
                        {TRACKS.map(t => (
                            <option key={t.id} value={t.path}>{t.name}</option>
                        ))}
                    </select>
                    
                    <div className="media-controls-grid">
                        <button className="media-btn" onClick={handlePrevTrack} title="Previous Track">
                            PREV
                        </button>
                        <button 
                            className={`media-btn ${audioPlaying ? 'active' : ''}`} 
                            onClick={handlePlayPauseToggle} 
                            title={audioPlaying ? "Pause" : "Play"}
                        >
                            {audioPlaying ? "PAUS" : "PLAY"}
                        </button>
                        <button className="media-btn" onClick={handleNextTrack} title="Next Track">
                            NEXT
                        </button>
                        <button 
                            className={`media-btn ${audioShuffle ? 'active' : ''}`} 
                            onClick={handleShuffleToggle} 
                            title="Toggle Shuffle"
                        >
                            SHUF
                        </button>
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
}
