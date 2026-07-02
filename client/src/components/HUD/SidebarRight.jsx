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
    isUnassigned
}) {
    return (
        <aside className="sidebar-right">
            <div className="sync-monitor">
                <div
                    className={`player-dot ${syncStatus?.lockedIn?.player1 ? 'ready' : ''}`}
                    title="Player 1"
                >
                    P1
                </div>
                <div
                    className={`player-dot ${syncStatus?.lockedIn?.player2 ? 'ready' : ''}`}
                    title="Player 2"
                >
                    P2
                </div>
            </div>

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
