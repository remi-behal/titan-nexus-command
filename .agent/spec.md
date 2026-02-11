# Technical Specifications

## 🏗️ Monorepo Layout
*   **`/client`**: React + Vite frontend.
*   **`/server`**: Node.js + Socket.io backend.
*   **`/shared`**: **Canonical Game Engine.** All physics and state math live here in `GameState.js`. No browser/Node dependencies allowed here.

## Technical Context
*   **WSL Environment**: All execution happens in Ubuntu-24.04 via WSL. Connection to WSL was established by the user using the Command Palette "Remote-WSL: Connect to WSL". 
*   **Host OS**: Antigravity runs on a Windows 11 machine, but **all project code** is in WSL.

## 📡 Networking Standard
*   **Vite Proxy**: Port 5173 proxies `/socket.io` to Port 3000.
*   **WSL Mode**: Mirrored networking should be enabled in `.wslconfig`.
*   **Browser Bridge**: See `.agent/workflows/browser-testing.md`.

## 🛠️ Development Workflow
*   **Run All**: `npm run dev` from the root.
*   **State Updates**:
    1. Update logic in `shared/GameState.js`.
    2. Handle event in `server/index.js`.
    3. Update UI in `client/src/App.jsx`.

## 🎨 Frontend Stack
*   **Canvas API**: Used for the main game board rendering to handle high object counts and complex links.
*   **React State**: Used for UI overlays, badges, and socket connectivity status.
