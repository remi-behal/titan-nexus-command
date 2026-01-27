import { useState, useEffect, useRef } from 'react'
import './App.css'
import { GameState } from './logic/GameState'
import GameBoard from './components/GameBoard'

const MAX_PULL_DISTANCE = 300;

function App() {
  const [playerState, setPlayerState] = useState(null)
  const [selectedHubId, setSelectedHubId] = useState(null)
  const [selectedItemType, setSelectedItemType] = useState('HUB')
  const [launchMode, setLaunchMode] = useState(false) // Whether "Launch" mode is active
  const [isAiming, setIsAiming] = useState(false)
  const [committedAction, setCommittedAction] = useState(null)
  const [showDebugPreview, setShowDebugPreview] = useState(false)

  const gameRef = useRef(new GameState())

  useEffect(() => {
    const pIds = ['player1', 'player2']
    gameRef.current.initializeGame(pIds)
    setPlayerState(gameRef.current.getState())
  }, [])

  const handleAimStart = (x, y) => {
    if (launchMode && !committedAction && selectedHubId) {
      setIsAiming(true)
    }
  }

  const handleAimEnd = (x, y) => {
    if (!isAiming) return
    setIsAiming(false)

    const hub = playerState.entities.find(e => e.id === selectedHubId)
    if (!hub) return

    // Calculate Slingshot (Opposite of drag)
    const dx = x - hub.x
    const dy = y - hub.y
    let distance = Math.sqrt(dx * dx + dy * dy)

    // Clamp distance
    if (distance > MAX_PULL_DISTANCE) {
      distance = MAX_PULL_DISTANCE;
    }

    const angle = Math.atan2(-dy, -dx) * (180 / Math.PI)

    const action = {
      playerId: 'player1',
      type: 'LAUNCH',
      itemType: selectedItemType,
      sourceId: hub.id,
      sourceX: hub.x,
      sourceY: hub.y,
      angle: angle,
      distance: distance
    }

    setCommittedAction(action)
    setLaunchMode(false)
  }

  const handleExecuteTurn = () => {
    const actions = committedAction ? [committedAction] : []
    const nextState = gameRef.current.resolveTurn(actions)
    setPlayerState(nextState)
    setCommittedAction(null)
    setSelectedHubId(null)
    setLaunchMode(false)
  }

  if (!playerState) return <div>Loading Game...</div>
  const p1 = playerState.players['player1']

  return (
    <div className="App">
      <header className="game-header">
        <div className="player-info">
          <h1>Titan: Nexus Command</h1>
          <h2>Energy: {p1.energy}</h2>
          <p>Turn: {playerState.turn}</p>
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
            disabled={committedAction}
          >
            <option value="HUB">New Hub</option>
            <option value="WEAPON">Weapon</option>
            <option value="EXTRACTOR">Extractor</option>
            <option value="DEFENSE">Static Defense</option>
          </select>

          <button
            className={`launch-btn ${launchMode ? 'active' : ''}`}
            onClick={() => setLaunchMode(true)}
            disabled={!selectedHubId || committedAction}
          >
            {committedAction ? 'Action Committed' : 'Click Hub to Launch'}
          </button>

          <button className="execute-btn" onClick={handleExecuteTurn}>
            End Round (Simulate)
          </button>
        </div>
      </header>

      <main className="game-world">
        <GameBoard
          gameState={playerState}
          selectedHubId={selectedHubId}
          isAiming={isAiming}
          committedAction={committedAction}
          showDebugPreview={showDebugPreview}
          maxPullDistance={MAX_PULL_DISTANCE}
          onSelectHub={setSelectedHubId}
          onAimStart={handleAimStart}
          onAimUpdate={() => { }}
          onAimEnd={handleAimEnd}
        />
        {launchMode && <div className="hint-overlay">Pull back from the Hub to Aim & Launch!</div>}
      </main>

      <footer className="debug-info">
        <p>
          {selectedHubId
            ? `Hub ${selectedHubId} Selected. ${launchMode ? 'Action: Pull back to sling!' : 'Click "Launch" to aim.'}`
            : 'Click your Hub to select it.'}
        </p>
      </footer>
    </div>
  )
}

export default App
