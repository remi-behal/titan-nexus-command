# Design: Docker Deployment for Titan: Nexus Command

## Goal
Deploy the game to a local Docker server, integrated with an existing Nginx Proxy Manager (NPM) and Cloudflare setup, to allow 2-player testing over the internet/local network via `titannexuscommand.rbtek.space`.

## Architecture
We will use a "Single Entry Point" architecture where the Client container handles both static file serving and internal proxying to the game server.

### Component Breakdown

#### 1. Server Container (`titan-server`)
- **Base Image**: `node:20-slim`
- **Port**: `3001` (Internal)
- **Role**: Handles game state, turn resolution, and WebSockets.
- **Environment**: 
    - `PORT=3001`
    - `NODE_ENV=production`

#### 2. Client Container (`titan-client`)
- **Stage 1 (Build)**: Uses `node:20` to run `npm run build`.
- **Stage 2 (Production)**: Uses `nginx:stable-alpine`.
- **Port**: `5173` (Mapped to Host)
- **Role**: Serves static React assets and proxies `/socket.io` to the `titan-server` container.
- **Configuration**: Custom `nginx.conf` to handle SPA routing and WebSocket upgrades.

#### 3. Orchestration (`docker-compose.yml`)
- Defines a shared network for the two containers.
- Maps port `5173` on the host to the client container.
- Ensures the server is reachable by the client via the hostname `titan-server`.

## Nginx Proxy Manager (NPM) Configuration
- **Domain**: `titannexuscommand.rbtek.space`
- **Forward Scheme**: `http`
- **Forward Host**: `<SERVER_IP>`
- **Forward Port**: `5173`
- **Websockets Support**: ENABLED
- **SSL**: Let's Encrypt (Managed by NPM)

## Data Persistence
- No database is currently used. 
- **Volumes**: We will mount `/home/behalr/titan-nexus-command/server/maps` to the server container to allow custom maps created in the designer to persist across container restarts.

## Verification Plan
1. **Build**: Run `docker-compose build` to ensure both images create successfully.
2. **Launch**: Run `docker-compose up -d`.
3. **Local Check**: Access `http://localhost:5173` to verify the game loads.
4. **Network Check**: Access `https://titannexuscommand.rbtek.space` from a mobile phone or second computer.
5. **Gameplay**: Verify Player 1 and Player 2 can both claim seats in the lobby.
