import { useState, useEffect, useRef } from 'react'
import './App.css'
import { GameState } from '../../shared/GameState.js'
import { ENTITY_STATS, GLOBAL_STATS } from '../../shared/EntityStats.js'
import GameBoard from './components/GameBoard'
import { io } from 'socket.io-client'

const socket = io('/', {
  transports: ['polling', 'websocket'],
  autoConnect: true
})

const MAX_PULL_DISTANCE = GLOBAL_STATS.MAX_PULL;

// Session Token Management
const SESSION_TOKEN_KEY = 'titan_nexus_session_token';
const getSessionToken = () => {
  let token = localStorage.getItem(SESSION_TOKEN_KEY);
  if (!token) {
    token = self.crypto.randomUUID();
    localStorage.setItem(SESSION_TOKEN_KEY, token);
  }
  return token;
};

function App() {
  const [playerState, setPlayerState] = useState(null)
  const turnRef = useRef(1) // Track turn for stale closures in listeners
  const [isConnected, setIsConnected] = useState(socket.connected)
  const [myPlayerId, setMyPlayerId] = useState(null)
  const [syncStatus, setSyncStatus] = useState({ lockedIn: { player1: false, player2: false } })
  const [lastError, setLastError] = useState(null)
  const [selectedHubId, setSelectedHubId] = useState(null)
  const [selectedItemType, setSelectedItemType] = useState('HUB')
  const [launchMode, setLaunchMode] = useState(false)
  const [isAiming, setIsAiming] = useState(false)
  const [committedActions, setCommittedActions] = useState([])
  const [showDebugPreview, setShowDebugPreview] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(30)
  const [isResolving, setIsResolving] = useState(false)
  const isResolvingPhase = playerState?.phase === 'RESOLVING';
  const isResolvingUI = isResolving || isResolvingPhase;
  const isLocked = syncStatus?.lockedIn?.[myPlayerId] || false;

  const handleAimStart = (overrideHubId) => {
    const targetHubId = overrideHubId || selectedHubId;
    if (!targetHubId) return;

    // Check if selected structure has fuel
    const selectedEntity = playerState?.entities?.find(e => e.id === targetHubId);
    const pendingFuelSpent = committedActions.filter(a => a.sourceId === targetHubId).length;
    const hasFuel = selectedEntity ? (selectedEntity.fuel === undefined || (selectedEntity.fuel - pendingFuelSpent) > 0) : false;

    if (launchMode && !isLocked && hasFuel) {
      setIsAiming(true)
    }
  }

  const handleAimEnd = (x, y) => {
    if (!isAiming) return
    setIsAiming(false)

    const hub = playerState.entities.find(e => e.id === selectedHubId)
    if (!hub) return

    // Calculate Slingshot (Opposite of drag)
    // Use toroidal-aware vector subtraction so dragging across edges works correctly
    const { dx, dy } = GameState.getToroidalVector(hub.x, hub.y, x, y, playerState.map.width, playerState.map.height);
    let distance = Math.sqrt(dx * dx + dy * dy)

    // Clamp distance
    if (distance > MAX_PULL_DISTANCE) {
      distance = MAX_PULL_DISTANCE;
    }

    const angle = GameState.calculateLaunchAngle(dx, dy);

    const action = {
      playerId: myPlayerId,
      type: 'LAUNCH',
      itemType: selectedItemType,
      sourceId: hub.id,
      sourceX: hub.x,
      sourceY: hub.y,
      angle: angle,
      distance: distance
    }

    setCommittedActions(prev => [...prev, action])
    setLaunchMode(false)
  }

  const handleExecuteTurn = () => {
    if (committedActions.length > 0) {
      socket.emit('submitActions', committedActions)
    } else {
      socket.emit('passTurn')
    }
  };

  const handleClearActions = () => {
    setCommittedActions([]);
    setLaunchMode(false);
  }

  const handleRestart = () => {
    socket.emit('restartGame')
    setCommittedActions([])
    setSelectedHubId(null)
    setLaunchMode(false)
  }

  useEffect(() => {
    console.log('Connecting to socket...');

    const onConnect = () => {
      console.log('Socket connected!', socket.id);
      setIsConnected(true);
      
      const token = getSessionToken();
      socket.emit('authenticate', token);
      socket.emit('requestState');
    };

    const onDisconnect = () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    };

    const onUpdate = (newState) => {
      setPlayerState(newState);

      // Reset local committed state ONLY when the turn has advanced
      if (newState.turn > turnRef.current) {
        setCommittedActions([]);
        turnRef.current = newState.turn;
      }
      setSelectedHubId(null)
      setLaunchMode(false)
    };

    const onAssignment = (assignedId) => {
      console.log('Assigned as:', assignedId);
      setMyPlayerId(assignedId);
    };

    const onSyncStatus = (status) => {
      setSyncStatus(status);
    };

    const onTimerUpdate = (timeLeft) => {
      setTimeRemaining(timeLeft);
    };

    // CRASH REPORTER: Catch any runtime errors and show them on screen
    const handleGlobalError = (event) => {
      setLastError(`CRASH: ${event.message} at ${event.filename}:${event.lineno}`);
    };
    window.addEventListener('error', handleGlobalError);

    const onError = (err) => {
      console.error('Socket connection error:', err);
      setIsConnected(false);
      setLastError(err.message || JSON.stringify(err));
    };

    const onResolutionStatus = (status) => {
      setIsResolving(status.active);
      if (status.active) {
        // As soon as resolution officially starts, clear local staged actions
        // so they don't overlap with the server-side simulation projectiles.
        setCommittedActions([]);
      }
    };

    const onMatchRestarted = () => {
      console.log('Match restarted! Re-authenticating...');
      const token = getSessionToken();
      socket.emit('authenticate', token);
      socket.emit('requestState');
    };



    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('gameStateUpdate', onUpdate);
    socket.on('playerAssignment', onAssignment);
    socket.on('syncStatus', onSyncStatus);
    socket.on('timerUpdate', onTimerUpdate);
    socket.on('resolutionStatus', onResolutionStatus);
    socket.on('matchRestarted', onMatchRestarted);
    socket.on('connect_error', onError);

    // Initial check in case it connected before the effect ran
    if (socket.connected) onConnect();

    return () => {
      window.removeEventListener('error', handleGlobalError);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('gameStateUpdate', onUpdate);
      socket.off('playerAssignment', onAssignment);
      socket.off('syncStatus', onSyncStatus);
      socket.off('timerUpdate', onTimerUpdate);
      socket.off('resolutionStatus', onResolutionStatus);
      socket.off('matchRestarted', onMatchRestarted);
      socket.off('connect_error', onError);
    }
  }, [])

  // Sync actions to server as they are created locally
  useEffect(() => {
    if (!isLocked && !isResolvingUI && committedActions.length >= 0) {
      socket.emit('syncActions', committedActions);
    }
  }, [committedActions, isLocked, isResolvingUI]);

  // Note: We used to auto-submit here, but the server is the primary authority for turn resolution.
  // Letting the client auto-submit at 0 creates a race condition where it triggers for Turn 2
  // while state is still synchronising.


  // Defensive check: Stay on loading screen until we have BOTH state and an assignment
  // Ensure we have a valid player object (with defaults if still loading)
  const pBase = (playerState?.players && playerState.players[myPlayerId])
    ? playerState.players[myPlayerId]
    : { energy: 0, color: '#fff', alive: true };

  // Calculate energy after local (but not yet sent) commitments
  const pendingCost = committedActions.reduce((sum, act) => sum + (ENTITY_STATS[act.itemType]?.cost || 0), 0);
  const pCurrent = {
    ...pBase,
    energy: Math.max(0, pBase.energy - pendingCost)
  };


  const header = (
    <header className="game-header">
      <div className="player-info" style={{ color: pCurrent.color }}>
        <h1>Titan: Nexus Command</h1>
        <div className="status-bars">
          <span className="badge">You: {myPlayerId || 'Pending'}</span>
          <span className="energy">Energy: {pCurrent.energy}</span>
          {(() => {
            // Calculate projected turn income
            let projectedIncome = GLOBAL_STATS.ENERGY_INCOME_PER_TURN;
            playerState?.entities?.forEach(entity => {
              if (entity.owner === myPlayerId) {
                const stats = ENTITY_STATS[entity.type];
                if (stats && stats.energyGen) {
                  projectedIncome += stats.energyGen;
                  if (entity.type === 'EXTRACTOR') {
                    const node = playerState.map.resources.find(res => {
                      // Basic dist calculation (ignoring wrap for UI preview is usually fine, but let's be accurate)
                      let dx = Math.abs(res.x - entity.x);
                      let dy = Math.abs(res.y - entity.y);
                      if (dx > playerState.map.width / 2) dx = playerState.map.width - dx;
                      if (dy > playerState.map.height / 2) dy = playerState.map.height - dy;
                      const dist = Math.sqrt(dx * dx + dy * dy);
                      return dist <= GLOBAL_STATS.RESOURCE_CAPTURE_RADIUS;
                    });
                    if (node) projectedIncome += node.value;
                  }
                }
              }
            });
            return <span className="income" title="Projected income next turn"> (+{projectedIncome})</span>;
          })()}
          <span className="turn">Turn: {playerState?.turn || 1}</span>
          <span className={`timer ${timeRemaining <= 10 ? 'low' : ''}`}>Time: {timeRemaining}s</span>
        </div>
      </div>

      <div className="sync-monitor">
        <div className={`player-dot ${syncStatus?.lockedIn?.player1 ? 'ready' : ''}`} title="Player 1">P1</div>
        <div className={`player-dot ${syncStatus?.lockedIn?.player2 ? 'ready' : ''}`} title="Player 2">P2</div>
      </div>

      <div className="controls">
        <div className="debug-toggle">
          <label>
            <input
              type="checkbox"
              checked={showDebugPreview}
              onChange={(e) => setShowDebugPreview(e.target.checked)}
            />
            Show Landing Preview
          </label>
        </div>

        <select
          value={selectedItemType}
          onChange={(e) => setSelectedItemType(e.target.value)}
          disabled={isLocked || isResolvingUI}
        >
          <option value="HUB" disabled={pCurrent.energy < ENTITY_STATS.HUB.cost}>
            New Hub ({ENTITY_STATS.HUB.cost} E)
          </option>
          <option value="WEAPON" disabled={pCurrent.energy < ENTITY_STATS.WEAPON.cost}>
            Weapon ({ENTITY_STATS.WEAPON.cost} E)
          </option>
          <option value="EXTRACTOR" disabled={pCurrent.energy < ENTITY_STATS.EXTRACTOR.cost}>
            Extractor ({ENTITY_STATS.EXTRACTOR.cost} E)
          </option>
          <option value="DEFENSE" disabled={pCurrent.energy < ENTITY_STATS.DEFENSE.cost}>
            Static Defense ({ENTITY_STATS.DEFENSE.cost} E)
          </option>
          <option value="HOMING_MISSILE" disabled={pCurrent.energy < ENTITY_STATS.HOMING_MISSILE.cost}>
            Homing Missile ({ENTITY_STATS.HOMING_MISSILE.cost} E)
          </option>
          <option value="SUPER_BOMB" disabled={pCurrent.energy < (ENTITY_STATS.SUPER_BOMB?.cost || 10)}>
            Super Bomb [TEST] ({ENTITY_STATS.SUPER_BOMB?.cost || 10} E)
          </option>
        </select>

        {(() => {
          const selectedEntity = playerState?.entities?.find(e => e.id === selectedHubId);
          const pendingFuelSpent = committedActions.filter(a => a.sourceId === selectedHubId).length;
          const remainingFuel = selectedEntity?.fuel !== undefined ? (selectedEntity.fuel - pendingFuelSpent) : Infinity;
          const hasFuel = remainingFuel > 0;
          const fuelCostWarning = !hasFuel ? "Out of Fuel" : null;

          return (
            <button
              className={`launch-btn ${launchMode ? 'active' : ''}`}
              onClick={() => setLaunchMode(active => !active)}
              disabled={!selectedHubId || isLocked || isResolvingUI || pCurrent.energy < (ENTITY_STATS[selectedItemType]?.cost || 0) || !hasFuel}
            >
              {isResolvingUI
                ? 'Observation Phase'
                : isLocked
                  ? 'Mission Locked'
                  : fuelCostWarning
                    ? fuelCostWarning
                    : pCurrent.energy < (ENTITY_STATS[selectedItemType]?.cost || 0)
                      ? `Insufficient Energy (${ENTITY_STATS[selectedItemType]?.cost} E)`
                      : launchMode ? 'Cancel Aiming' : 'Launch New Structure'}
            </button>
          );
        })()}

        {committedActions.length > 0 && !isLocked && !isResolvingUI && (
          <button className="clear-btn" onClick={handleClearActions}>
            Clear All ({committedActions.length})
          </button>
        )}

        <button
          className={`execute-btn ${isLocked ? 'waiting' : ''}`}
          onClick={handleExecuteTurn}
          disabled={isLocked || isResolvingUI}
        >
          {isResolvingUI ? 'Resolving...' : (isLocked ? 'Waiting for others...' : (committedActions.length > 0 ? `Complete Turn (${committedActions.length})` : 'Complete Turn'))}
        </button>
      </div>
    </header>
  );

  // Defensive check: Stay on loading screen until we have BOTH state and an assignment
  if (!playerState || !myPlayerId) {
    return (
      <div className="App">
        {header}
        <div className="loading-screen" style={{ minHeight: '300px' }}>
          <p>{!playerState ? "Downloading Sector Data..." : "Authenticating Pilot..."}</p>
          <div className="status-indicator">
            Socket: {isConnected ? 'Online' : 'Offline'} | ID: {myPlayerId || 'Pending'}
          </div>
          {lastError && <div className="error-display" style={{ color: '#ff6464', marginTop: '10px' }}>Error: {lastError}</div>}
          {!isConnected && <button onClick={() => { setLastError(null); socket.connect(); }} style={{ marginTop: '10px' }}>Reconnect</button>}
        </div>
      </div>
    )
  }

  return (
    <div className="App">
      {header}

      <main className={`game-world ${isResolvingUI ? 'locked-out' : ''}`}>
        {!isResolvingUI && !committedActions.length && selectedHubId && launchMode && (
          <div className="hint-overlay">
            Drag from your selected Hub to launch
          </div>
        )}

        <GameBoard
          gameState={playerState}
          myPlayerId={myPlayerId}
          selectedHubId={selectedHubId}
          launchMode={launchMode}
          isAiming={isAiming}
          committedActions={committedActions}
          showDebugPreview={showDebugPreview}
          maxPullDistance={MAX_PULL_DISTANCE}
          isResolving={isResolvingUI}
          onSelectHub={setSelectedHubId}
          onAimStart={handleAimStart}
          onAimUpdate={() => { }}
          onAimEnd={handleAimEnd}
        />
        {launchMode && !isResolvingUI && <div className="hint-overlay">Pull back from the Hub to Aim & Launch!</div>}
      </main>

      <footer className="debug-info">
        <p>
          {selectedHubId
            ? `Hub ${selectedHubId} Selected. ${launchMode ? 'Action: Pull back to sling!' : 'Click "Launch" to aim.'}`
            : 'Click your Hub to select it.'}
        </p>
      </footer>

      {playerState.winner && (
        <div className="winner-overlay">
          <div className="winner-card" style={{ borderColor: playerState.players[playerState.winner]?.color || '#fff' }}>
            <h2>{playerState.winner === 'DRAW' ? "It's a Draw!" : "Victory!"}</h2>
            <p>{playerState.winner === 'DRAW' ? "Mutual destruction on Titan." : `Player ${playerState.winner} has conquered the sector.`}</p>
            <button className="restart-btn" onClick={handleRestart}>Initialize New Mission</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
