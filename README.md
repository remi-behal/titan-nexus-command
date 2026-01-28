# Titan: Nexus Command

A browser-based, simultaneous turn-based multiplayer game set on the surface of Saturn's moon, Titan.

## 🚀 Quick Start

1. **Install Dependencies**:
   ```bash
   npm run install:all
   ```

2. **Run Development Mode** (Starts both Client & Server):
   ```bash
   npm run dev
   ```

## 📂 Project Structure

- `client/`: React + Vite frontend application.
- `server/`: Node.js + Socket.io backend server.
- `shared/`: Shared game logic (State engine, constants).
- `task.md`: Current development roadmap.
- `testing_plan.md`: Documentation for testing scenarios.

## 🛠️ Tech Stack

- **Frontend**: React, HTML5 Canvas, Socket.io-client.
- **Backend**: Node.js, Express, Socket.io.
- **Environment**: WSL (Ubuntu 24.04).

## 🪐 Game Mechanics

- **Simultaneous Turns**: Every player locks in their move at once.
- **Slingshot Launch**: Launch structures from hubs using a drag-and-release mechanic.
- **Titan Atmosphere**: Skill-based judge of power and angle.
