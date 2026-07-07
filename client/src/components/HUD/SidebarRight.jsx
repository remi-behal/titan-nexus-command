import React from 'react';

/**
 * SidebarRight component handles the right HUD panel, displaying turn, timer,
 * sync markers for multiplayer lobbies, pending action list clear triggers, and
 * the primary uplink turn execution button.
 */
export default function SidebarRight({
    syncStatus,
    playerState,
    timeRemaining,
    showDebugPreview,
    cameraOffset,
    zoom,
    committedActions,
    interactionBlocked,
    handleClearActions,
    handleExecuteTurn,
    isLocked,
    isResolvingUI,
    isSpectator,
    isUnassigned,
    isSandbox = false,
    activeSandboxPlayer,
    setActiveSandboxPlayer,
    onExitSandbox
}) {
    return (
        <aside className="sidebar-right">
            {!isSandbox ? (
                <div className="sync-monitor">
                    {Object.keys(playerState?.players || { player1: {}, player2: {} }).map((pid) => {
                        const p = playerState?.players?.[pid];
                        const isReady = syncStatus?.lockedIn?.[pid];
                        const name = p?.name || pid.replace('player', 'Player ');
                        return (
                            <div
                                key={pid}
                                className={`player-dot ${isReady ? 'ready' : ''}`}
                                title={name}
                                style={p?.color ? { borderColor: p.color } : {}}
                            >
                                {name.slice(0, 2).toUpperCase()}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="sandbox-controls" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #222', paddingBottom: '12px' }}>
                    <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#666', letterSpacing: '1px', marginBottom: '4px' }}>PRACTICE RANGE | ACTIVE PILOT:</div>
                    <button
                        style={{
                            background: activeSandboxPlayer === 'player1' ? 'hsl(0, 100%, 68%)' : '#222',
                            color: activeSandboxPlayer === 'player1' ? '#000' : '#888',
                            border: '1px solid #444',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            borderRadius: '4px',
                            fontFamily: 'Courier New, monospace'
                        }}
                        onClick={() => {
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
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            borderRadius: '4px',
                            fontFamily: 'Courier New, monospace'
                        }}
                        onClick={() => {
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
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            borderRadius: '4px',
                            marginTop: '12px',
                            fontFamily: 'Courier New, monospace'
                        }}
                        onClick={onExitSandbox}
                    >
                        EXIT RANGE
                    </button>
                </div>
            )}

            <div className="controls-stack">
                <div className="stats-blocks">
                    <div className="stat-group">
                        <span className="label">Turn:</span>
                        <span className="value turn">{playerState?.turn || 1}</span>
                    </div>
                    <div className="stat-group timer-group">
                        <span className="label">Time:</span>
                        <span className={`value timer ${timeRemaining <= 10 ? 'low' : ''}`}>
                            {timeRemaining}s
                        </span>
                    </div>
                    {showDebugPreview && playerState?.map && (
                        <>
                            <div
                                className="stat-group"
                                style={{ color: '#0f0', fontSize: '0.8em', marginTop: '10px' }}
                            >
                                <span className="label">Center:</span>
                                <span className="value">
                                    {(cameraOffset.x + playerState.map.width / zoom / 2).toFixed(0)}
                                    ,{' '}
                                    {(cameraOffset.y + playerState.map.height / zoom / 2).toFixed(
                                        0
                                    )}
                                </span>
                            </div>
                        </>
                    )}
                </div>

                {committedActions.length > 0 && !interactionBlocked && (
                    <button className="clear-btn" onClick={handleClearActions}>
                        Clear ({committedActions.length})
                    </button>
                )}

                <div className="spacer" style={{ flex: 1 }} />

                <button
                    className={`execute-btn ${isLocked ? 'waiting' : ''}`}
                    onClick={handleExecuteTurn}
                    disabled={interactionBlocked}
                >
                    {isResolvingUI
                        ? 'Simulating'
                        : isLocked
                          ? 'Waiting'
                          : isSpectator
                            ? 'Spectating'
                            : isUnassigned
                              ? '...'
                              : committedActions.length > 0
                                ? `Ready (${committedActions.length})`
                                : 'Ready'}
                </button>
            </div>
        </aside>
    );
}
