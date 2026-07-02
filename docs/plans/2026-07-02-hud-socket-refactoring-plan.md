# HUD and Socket.io Refactoring Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Refactor client-side App.jsx by extracting Socket.io connection logic and chiptune media controllers into modular, isolated files.

**Architecture:** We will create a `useGameSocket` hook to encapsulate connection state, handshaking, and event listeners. Chiptune music state and audioManager subscription will be delegated entirely to `SidebarLeft.jsx`. `App.jsx` will be simplified to a layout routing component.

**Tech Stack:** React, Socket.io-client, Vitest.

---

### Task 1: Create the useGameSocket React Hook

**Files:**
- Create: `client/src/hooks/useGameSocket.js`
- Create: `client/src/hooks/useGameSocket.test.jsx`

**Step 1: Write the failing test**
Create `client/src/hooks/useGameSocket.test.jsx` to verify that the hook initializes correctly and returns connection properties.

```javascript
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameSocket } from './useGameSocket';

describe('useGameSocket hook', () => {
    it('initializes socket states', () => {
        const { result } = renderHook(() => useGameSocket());
        expect(result.current.isConnected).toBeDefined();
        expect(result.current.chatMessages).toBeInstanceOf(Array);
        expect(result.current.committedActions).toBeInstanceOf(Array);
    });
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run client/src/hooks/useGameSocket.test.jsx`
Expected: FAIL with module resolution error (cannot find `./useGameSocket`).

**Step 3: Write minimal implementation**
Create `client/src/hooks/useGameSocket.js` with the full socket networking logic:

```javascript
import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export const socket = io('/', {
    transports: ['polling', 'websocket'],
    autoConnect: true
});

const SESSION_TOKEN_KEY = 'titan_nexus_session_token';
const getSessionToken = () => {
    let token = localStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) {
        token = self.crypto.randomUUID();
        localStorage.setItem(SESSION_TOKEN_KEY, token);
    }
    return token;
};

export function useGameSocket() {
    const [playerState, setPlayerState] = useState(null);
    const turnRef = useRef(1);
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [myPlayerId, setMyPlayerId] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [syncStatus, setSyncStatus] = useState({ lockedIn: { player1: false, player2: false } });
    const [lastError, setLastError] = useState(null);
    const [availableMaps, setAvailableMaps] = useState([]);
    const [committedActions, setCommittedActions] = useState([]);
    const [timeRemaining, setTimeRemaining] = useState(30);
    const [isResolving, setIsResolving] = useState(false);
    const [lobbyStatus, setLobbyStatus] = useState(null);
    const [matchStarted, setMatchStarted] = useState(false);

    const isLocked = syncStatus?.lockedIn?.[myPlayerId] || false;
    const isResolvingPhase = playerState?.phase === 'RESOLVING';
    const isResolvingUI = isResolving || isResolvingPhase;

    const handleSendMessage = (text) => {
        socket.emit('chat:sendMessage', { text });
    };

    const handleToggleChat = () => {
        setIsChatOpen((prev) => !prev);
        setUnreadCount(0);
    };

    const handleExecuteTurn = () => {
        if (committedActions.length > 0) {
            socket.emit('submitActions', committedActions);
        } else {
            socket.emit('passTurn');
        }
    };

    const handleClearActions = () => {
        setCommittedActions([]);
    };

    const handleRestart = () => {
        socket.emit('restartGame');
        setCommittedActions([]);
        setMatchStarted(false);
    };

    const handleClaimSeat = (index) => {
        socket.emit('lobby:claimSeat', index);
    };

    const handleReadyToggle = (isReady) => {
        socket.emit('lobby:ready', isReady);
    };

    const handleSetMap = (mapName) => {
        socket.emit('lobby:setMap', mapName);
    };

    const handleMapSave = (mapData) => {
        const name = prompt('Enter a name for your map:');
        if (name) {
            socket.emit('map:save', { name, data: mapData });
        }
    };

    useEffect(() => {
        const onConnect = () => {
            setIsConnected(true);
            const token = getSessionToken();
            socket.emit('authenticate', token);
        };

        const onDisconnect = () => {
            setIsConnected(false);
        };

        const onUpdate = (newState) => {
            setPlayerState(newState);
            setMatchStarted(true);

            if (newState.turn > turnRef.current) {
                setCommittedActions([]);
                turnRef.current = newState.turn;
            }
        };

        const onAssignment = (assignedId) => {
            setMyPlayerId(assignedId);
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('autoStart') === '1' && !assignedId) {
                socket.emit('lobby:autoJoin', { force: true });
            }
        };

        const onSyncStatus = (status) => {
            setSyncStatus(status);
        };

        const onTimerUpdate = (timeLeft) => {
            setTimeRemaining(timeLeft);
        };

        const onLobbyUpdate = (update) => {
            setLobbyStatus(update);
            if (update.status === 'IN_GAME') {
                setMatchStarted(true);
            }
        };

        const onMatchStarted = (data) => {
            setMatchStarted(true);
            const token = getSessionToken();
            socket.emit('authenticate', token);
            socket.emit('requestState');
        };

        const onMapsUpdate = (maps) => {
            setAvailableMaps(maps);
        };

        const onError = (err) => {
            setIsConnected(false);
            setLastError(err.message || JSON.stringify(err));
        };

        const onResolutionStatus = (status) => {
            setIsResolving(status.active);
            if (status.active) {
                setCommittedActions([]);
            }
        };

        const onMatchRestarted = () => {
            setMatchStarted(false);
            const token = getSessionToken();
            socket.emit('authenticate', token);
        };

        const onChatHistory = (history) => {
            setChatMessages(history);
        };

        const onChatNewMessage = (msg) => {
            setChatMessages((prev) => {
                if (prev.some((m) => m.id === msg.id)) return prev;
                return [...prev, msg];
            });
            setIsChatOpen((open) => {
                if (!open) {
                    setUnreadCount((count) => count + 1);
                    try {
                        if (typeof window !== 'undefined' && window.zzfx) {
                            window.zzfx(...[0.1, 0, 800, 0.05, 0.05, 0.05, 0, 1, 0.1]);
                        }
                    } catch (e) {
                        console.error('Audio playback failed', e);
                    }
                }
                return open;
            });
        };

        const onActionsUpdate = (actions) => {
            setCommittedActions(actions);
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('gameStateUpdate', onUpdate);
        socket.on('playerAssignment', onAssignment);
        socket.on('syncStatus', onSyncStatus);
        socket.on('timerUpdate', onTimerUpdate);
        socket.on('resolutionStatus', onResolutionStatus);
        socket.on('matchRestarted', onMatchRestarted);
        socket.on('lobby:update', onLobbyUpdate);
        socket.on('matchStarted', onMatchStarted);
        socket.on('room:mapsUpdate', onMapsUpdate);
        socket.on('connect_error', onError);
        socket.on('chat:history', onChatHistory);
        socket.on('chat:newMessage', onChatNewMessage);
        socket.on('actionsUpdate', onActionsUpdate);

        if (socket.connected) onConnect();

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('gameStateUpdate', onUpdate);
            socket.off('playerAssignment', onAssignment);
            socket.off('syncStatus', onSyncStatus);
            socket.off('timerUpdate', onTimerUpdate);
            socket.off('resolutionStatus', onResolutionStatus);
            socket.off('matchRestarted', onMatchRestarted);
            socket.off('lobby:update', onLobbyUpdate);
            socket.off('matchStarted', onMatchStarted);
            socket.off('room:mapsUpdate', onMapsUpdate);
            socket.off('connect_error', onError);
            socket.off('chat:history', onChatHistory);
            socket.off('chat:newMessage', onChatNewMessage);
            socket.off('actionsUpdate', onActionsUpdate);
        };
    }, []);

    useEffect(() => {
        if (!isLocked && !isResolvingUI && committedActions.length >= 0) {
            socket.emit('syncActions', committedActions);
        }
    }, [committedActions, isLocked, isResolvingUI]);

    return {
        socket,
        isConnected,
        myPlayerId,
        playerState,
        lobbyStatus,
        matchStarted,
        syncStatus,
        timeRemaining,
        isResolving: isResolvingUI,
        isLocked,
        chatMessages,
        isChatOpen,
        unreadCount,
        availableMaps,
        lastError,
        committedActions,
        setCommittedActions,
        setLastError,
        setMatchStarted,
        setIsChatOpen,
        setUnreadCount,
        handleSendMessage,
        handleToggleChat,
        handleExecuteTurn,
        handleClearActions,
        handleRestart,
        handleClaimSeat,
        handleReadyToggle,
        handleSetMap,
        handleMapSave
    };
}
```

**Step 4: Run test to verify it passes**
Run: `npx vitest run client/src/hooks/useGameSocket.test.jsx`
Expected: PASS.

**Step 5: Commit**
```bash
git add -f client/src/hooks/useGameSocket.js client/src/hooks/useGameSocket.test.jsx
git commit -m "feat: implement useGameSocket networking hook"
```

---

### Task 2: Encapsulate Audio Control inside `SidebarLeft.jsx`

**Files:**
- Modify: `client/src/components/HUD/SidebarLeft.jsx`
- Create: `client/src/components/HUD/SidebarLeft.test.jsx`

**Step 1: Write the failing test**
Create `client/src/components/HUD/SidebarLeft.test.jsx` that expects the sidebar to render and call `audioManager` commands internally.

```javascript
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SidebarLeft from './SidebarLeft';
import { audioManager } from '../../utils/AudioManager';

vi.mock('../../utils/AudioManager', () => ({
    audioManager: {
        subscribe: vi.fn(() => () => {}),
        playMusic: vi.fn(),
        setVolume: vi.fn(),
        toggleMute: vi.fn(),
        pauseMusic: vi.fn(),
        resumeMusic: vi.fn(),
        nextTrack: vi.fn(),
        prevTrack: vi.fn(),
        toggleShuffle: vi.fn(),
        isPlaying: false,
        isMuted: false,
        volume: 0.5,
        shuffle: false
    },
    TRACKS: [{ id: 'twimble', name: 'Twimble', path: '/audio/tracks/twimble.mod' }]
}));

describe('SidebarLeft', () => {
    it('renders player info and handles mute action internally', () => {
        const pCurrent = { color: '#00ff44', energy: 100 };
        render(
            <SidebarLeft
                myPlayerId="player1"
                pCurrent={pCurrent}
                playerState={{ turn: 1 }}
                isSpectator={false}
                selectedHubId={null}
            />
        );
        const muteButton = screen.getByTitle('Mute Audio');
        fireEvent.click(muteButton);
        expect(audioManager.toggleMute).toHaveBeenCalled();
    });
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run client/src/components/HUD/SidebarLeft.test.jsx`
Expected: FAIL since SidebarLeft still depends on external click/volume handlers passed as props.

**Step 3: Write minimal implementation**
Modify `client/src/components/HUD/SidebarLeft.jsx` to setup internal audio subscriptions:

- Remove audio related props from parameters: `audioVolume`, `audioMuted`, `currentTrackPath`, `audioPlaying`, `audioShuffle`, and all handlers.
- Implement state hooks:
  ```javascript
  const [audioVolume, setAudioVolume] = useState(0.5);
  const [audioMuted, setAudioMuted] = useState(false);
  const [currentTrackPath, setCurrentTrackPath] = useState('/audio/tracks/twimble.mod');
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioShuffle, setAudioShuffle] = useState(false);
  ```
- Implement the subscription `useEffect` to `audioManager.subscribe`.
- Implement `useEffect` for `window` interaction click music warm-up.
- Implement the internal handlers: `handleVolumeChange`, `handleMuteToggle`, `handlePlayPauseToggle`, `handleNextTrack`, `handlePrevTrack`, `handleShuffleToggle`, `handleTrackChange`.

**Step 4: Run test to verify it passes**
Run: `npx vitest run client/src/components/HUD/SidebarLeft.test.jsx`
Expected: PASS.

**Step 5: Commit**
```bash
git add -f client/src/components/HUD/SidebarLeft.jsx client/src/components/HUD/SidebarLeft.test.jsx
git commit -m "feat: delegate chiptune music state control directly to SidebarLeft"
```

---

### Task 3: Streamline and Refactor `App.jsx`

**Files:**
- Modify: `client/src/App.jsx`

**Step 1: Verify current integration suite passes**
Run: `npx vitest run client/src/chat_app_integration.test.jsx`
Expected: PASS.

**Step 2: Modify App.jsx**
Update `client/src/App.jsx` to call `useGameSocket`:
- Import `useGameSocket` and the shared module `socket` from `./hooks/useGameSocket.js`.
- Remove socket module variable from top.
- Remove session token management functions, connection state hooks, and chat/socket `useEffect` blocks.
- Retrieve states and methods from `useGameSocket()`:
  ```javascript
  const {
      isConnected,
      myPlayerId,
      playerState,
      lobbyStatus,
      matchStarted,
      syncStatus,
      timeRemaining,
      isResolving,
      chatMessages,
      isChatOpen,
      unreadCount,
      availableMaps,
      lastError,
      committedActions,
      setCommittedActions,
      setLastError,
      setMatchStarted,
      setIsChatOpen,
      setUnreadCount,
      handleSendMessage,
      handleToggleChat,
      handleExecuteTurn,
      handleClearActions,
      handleRestart,
      handleClaimSeat,
      handleReadyToggle,
      handleSetMap,
      handleMapSave
  } = useGameSocket();
  ```
- Add a single simple turn transition listener to clean up local UI variables on turn advancement:
  ```javascript
  useEffect(() => {
      if (playerState?.turn > turnRef.current) {
          setSelectedHubId(null);
          setLaunchMode(false);
          turnRef.current = playerState.turn;
          audioManager.playRoundStart();
      }
  }, [playerState?.turn]);
  ```
- Update `SidebarLeft` props instantiation to pass only necessary layout/player info fields.
- Re-bind error listener to `setLastError`.

**Step 3: Run all client tests to verify they pass**
Run: `npx vitest run client/src/chat_app_integration.test.jsx client/src/hooks/useGameSocket.test.jsx client/src/components/HUD/SidebarLeft.test.jsx`
Expected: PASS.

**Step 4: Commit**
```bash
git add -f client/src/App.jsx
git commit -m "refactor: simplify App.jsx using useGameSocket hook and decoupled components"
```
