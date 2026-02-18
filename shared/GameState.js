/**
 * GameState.js
 * 
 * This class represents the "Single Source of Truth" for your game world.
 * It is designed to be "headless", meaning it doesn't care about rendering
 * or UI. This makes it easy to move to the server later!
 */

export class GameState {
    constructor() {
        this.turn = 1;
        this.players = {}; // { playerId: { energy: 100, color: 'red', alive: true } }
        this.entities = []; // [ { id, type: 'HUB', owner, x, y, hp } ]
        this.links = []; // [ { fromId, toId } ]
        this.map = {
            width: 2000,
            height: 2000,
            resources: [], // Energy nodes on the map
            obstacles: [] // Rocks, walls, etc.
        };
        this.winner = null;
    }

    static COSTS = {
        'HUB': 20,
        'WEAPON': 15,
        'EXTRACTOR': 25,
        'DEFENSE': 30
    };

    static VISION_RADIUS = {
        'HUB': 400,
        'EXTRACTOR': 200,
        'DEFENSE': 250,
        'PROJECTILE': 100
    };

    // Slingshot Constants
    static MAX_PULL = 300;
    static MAX_LAUNCH = 800; // The maximum distance a projectile can travel
    static POWER_EXPONENT = 1.6; // Higher = steeper difficulty curve at high power

    /**
     * Non-linear power curve math
     * Given a raw pull distance, returns the tactical launch distance.
     */
    static calculateLaunchDistance(pullDistance) {
        const clampedPull = Math.min(pullDistance, GameState.MAX_PULL);
        const ratio = clampedPull / GameState.MAX_PULL;
        // Exponential curve: precision at low power, high sensitivity at high power
        return Math.pow(ratio, GameState.POWER_EXPONENT) * GameState.MAX_LAUNCH;
    }

    /**
     * Calculate launch angle in degrees given a dx, dy pull vector.
     * Note: The launch direction is OPPOSITE to the pull direction.
     */
    static calculateLaunchAngle(dx, dy) {
        // We pull away from target, so launch is opposite (-dx, -dy)
        return Math.atan2(-dy, -dx) * (180 / Math.PI);
    }

    /**
     * Helper to get the shortest distance vector (dx, dy) between two points on a torus.
     */
    static getToroidalVector(x1, y1, x2, y2, w, h) {
        let dx = x2 - x1;
        let dy = y2 - y1;
        if (dx > w / 2) dx -= w;
        if (dx < -w / 2) dx += w;
        if (dy > h / 2) dy -= h;
        if (dy < -h / 2) dy += h;
        return { dx, dy };
    }

    /**
     * Map wrapping logic for Toroidal world
     */
    wrapX(x) {
        const w = this.map.width;
        return ((x % w) + w) % w;
    }

    wrapY(y) {
        const h = this.map.height;
        return ((y % h) + h) % h;
    }

    /**
     * Shortest distance between two points on a torus
     */
    getToroidalDistance(x1, y1, x2, y2) {
        let dx = Math.abs(x2 - x1);
        let dy = Math.abs(y2 - y1);

        if (dx > this.map.width / 2) dx = this.map.width - dx;
        if (dy > this.map.height / 2) dy = this.map.height - dy;

        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Checks if a specific coordinate is visible to a player.
     * Accounts for toroidal wrapping.
     */
    isPositionVisible(playerId, x, y) {
        if (!playerId || playerId === 'spectator') return true;

        return this.entities.some(e => {
            if (e.owner !== playerId) return false;
            const radius = GameState.VISION_RADIUS[e.type] || 0;
            if (radius === 0) return false;
            return this.getToroidalDistance(e.x, e.y, x, y) <= radius;
        });
    }

    /**
     * Returns a list of vision circles { x, y, radius } for a given player.
     */
    getVisionCircles(playerId) {
        if (!playerId || playerId === 'spectator') return [];

        return this.entities
            .filter(e => e.owner === playerId)
            .map(e => ({
                x: e.x,
                y: e.y,
                radius: GameState.VISION_RADIUS[e.type] || 0
            }))
            .filter(c => c.radius > 0);
    }

    /**
     * Returns a filtered version of the state based on what a player can see.
     * @param {string} playerId - The player requesting the state.
     * @param {object} [baseState] - Optional state object to filter (defaults to current state).
     */
    getVisibleState(playerId, baseState = null) {
        const state = baseState ? JSON.parse(JSON.stringify(baseState)) : this.getState();
        if (!playerId || playerId === 'spectator') return state;

        // Vision sources for this player in the provided state
        const visionSources = state.entities
            .filter(e => e.owner === playerId)
            .map(e => ({
                x: e.x,
                y: e.y,
                radius: GameState.VISION_RADIUS[e.type] || 0
            }))
            .filter(v => v.radius > 0);

        const isVisible = (x, y) => {
            return visionSources.some(v => this.getToroidalDistance(v.x, v.y, x, y) <= v.radius);
        };

        const entitiesRequiredByLinks = new Set();

        // Filter links: visible if either end is visible, or if any segment is visible
        state.links = state.links.filter(l => {
            const fullFrom = (baseState || this).entities.find(e => e.id === l.from);
            const fullTo = (baseState || this).entities.find(e => e.id === l.to);
            if (!fullFrom || !fullTo) return false;

            // Check endpoints
            const fromVisible = fullFrom.owner === playerId || isVisible(fullFrom.x, fullFrom.y);
            const toVisible = fullTo.owner === playerId || isVisible(fullTo.x, fullTo.y);

            if (fromVisible || toVisible) {
                entitiesRequiredByLinks.add(l.from);
                entitiesRequiredByLinks.add(l.to);
                return true;
            }

            // Check segments every 20 pixels to ensure visibility even if nodes are hidden
            let dx, dy;
            if (l.intendedDx !== null && l.intendedDx !== undefined) {
                dx = l.intendedDx;
                dy = l.intendedDy;
            } else {
                dx = fullTo.x - fullFrom.x;
                dy = fullTo.y - fullFrom.y;
                if (Math.abs(dx) > state.map.width / 2) dx = dx > 0 ? dx - state.map.width : dx + state.map.width;
                if (Math.abs(dy) > state.map.height / 2) dy = dy > 0 ? dy - state.map.height : dy + state.map.height;
            }

            const distance = Math.sqrt(dx * dx + dy * dy);
            const segments = Math.max(1, Math.ceil(distance / 20));

            for (let i = 0; i <= segments; i++) {
                const ratio = i / segments;
                const sx = this.wrapX(fullFrom.x + dx * ratio);
                const sy = this.wrapY(fullFrom.y + dy * ratio);
                if (isVisible(sx, sy)) {
                    entitiesRequiredByLinks.add(l.from);
                    entitiesRequiredByLinks.add(l.to);
                    return true;
                }
            }

            return false;
        });

        // Filter entities: own entities always visible, others only if in vision OR required by a visible link
        state.entities = (baseState || this).entities.map(e => {
            const isOwn = e.owner === playerId;
            const inVision = isVisible(e.x, e.y);
            const isLinkEndpoint = entitiesRequiredByLinks.has(e.id);

            if (isOwn || inVision || isLinkEndpoint) {
                return {
                    ...e,
                    scouted: isOwn || inVision // Only true if actively seen or owned
                };
            }
            return null;
        }).filter(e => e !== null);

        return state;
    }

    /**
     * Initialize a new game for a set of players
     */
    initializeGame(playerIds) {
        this.turn = 1;
        this.entities = [];
        this.links = [];
        this.players = {};
        this.winner = null;

        playerIds.forEach((id, index) => {
            // Create Player data
            this.players[id] = {
                energy: 50, // Starting energy
                color: `hsl(${index * 60}, 70%, 50%)`,
                alive: true
            };

            // Create initial Hub for each player
            const startX = 250 + (index * 500); // Spread at 25% and 75% width
            const startY = 500;

            this.addEntity({
                type: 'HUB',
                owner: id,
                x: startX,
                y: startY,
                hp: 100,
                isStarter: true
            });
        });

        // Mock some resource nodes
        this.map.resources = [
            { id: 'res1', x: 500, y: 300, value: 10 },
            { id: 'res2', x: 500, y: 700, value: 10 },
            { id: 'res3', x: 500, y: 500, value: 20 }
        ];
    }

    /**
     * Link Decay: Any structure not connected (via links) to 
     * its player's starter hub is destroyed.
     */
    checkLinkIntegrity() {
        const toDestroy = new Set();

        Object.keys(this.players).forEach(pid => {
            const starter = this.entities.find(e => e.owner === pid && e.isStarter);
            if (!starter) return; // If starter is gone, player is dead anyway

            const connected = new Set();
            const queue = [starter.id];
            connected.add(starter.id);

            while (queue.length > 0) {
                const currentId = queue.shift();
                // Find all entities linked to this one
                this.links.forEach(link => {
                    let neighborId = null;
                    if (link.from === currentId) neighborId = link.to;
                    if (link.to === currentId) neighborId = link.from;

                    if (neighborId && !connected.has(neighborId)) {
                        const neighbor = this.entities.find(e => e.id === neighborId);
                        if (neighbor && neighbor.owner === pid) {
                            connected.add(neighborId);
                            queue.push(neighborId);
                        }
                    }
                });
            }

            // Mark for destruction all entities owned by this player that aren't in 'connected'
            this.entities.forEach(e => {
                if (e.owner === pid && !connected.has(e.id)) {
                    toDestroy.add(e.id);
                }
            });
        });

        if (toDestroy.size > 0) {
            console.log(`[Link Decay] Destroying orphaned entities: ${Array.from(toDestroy).join(', ')}`);
            this.entities = this.entities.filter(e => !toDestroy.has(e.id));
            this.links = this.links.filter(l => !toDestroy.has(l.from) && !toDestroy.has(l.to));
        }
    }

    addEntity(data) {
        const id = Math.random().toString(36).substring(2, 10); // Node-friendly unique ID

        // Default Fuel Logic: HUBs and DEFENSE structures start with 3 fuel
        const fuelTypes = ['HUB', 'DEFENSE'];
        const initialFuel = fuelTypes.includes(data.type) ? 3 : undefined;

        const entity = {
            id,
            ...data,
            fuel: initialFuel,
            maxFuel: initialFuel,
            hp: data.hp || 50
        };
        this.entities.push(entity);
        return entity;
    }

    addLink(fromId, toId, owner, intendedDx = null, intendedDy = null) {
        this.links.push({
            from: fromId,
            to: toId,
            owner,
            intendedDx,
            intendedDy
        });
    }

    /**
     * This is where the magic happens. 
     * It processes all inputs and updates the state for the next turn.
     */
    /**
     * Iterative Round Resolution
     * Returns an array of snapshots so the client can "watch" the resolution unfold.
     */
    resolveTurn(playerActionsMap) {
        const snapshots = [];
        if (this.winner) {
            snapshots.push({ type: 'FINAL', state: this.getState() });
            return snapshots;
        }

        // 1. Generate Energy for all active players
        Object.keys(this.players).forEach(pid => {
            if (!this.players[pid].alive) return;
            this.players[pid].energy += 10;
        });
        snapshots.push({ type: 'ENERGY', state: this.getState() });

        // 2. Process Actions with "Skip-and-Slide" Logic
        const playerIds = Object.keys(this.players);
        const actionPointers = {};
        playerIds.forEach(pid => actionPointers[pid] = 0);

        let round = 0;
        let activeInProgress = true;

        while (activeInProgress) {
            round++;
            const roundActions = [];

            // a. Collection: Find the next valid action for this player
            playerIds.forEach(pid => {
                const actions = playerActionsMap[pid] || [];

                // Skip-and-Slide: Find the next valid action for this player
                while (actionPointers[pid] < actions.length) {
                    const action = actions[actionPointers[pid]];
                    const source = this.entities.find(e => e.id === action.sourceId);

                    if (source && (source.fuel === undefined || source.fuel > 0)) {
                        // Found a valid action for this round
                        roundActions.push(action);
                        actionPointers[pid]++;
                        break;
                    } else {
                        actionPointers[pid]++;
                    }
                }
            });

            if (roundActions.length > 0) {
                // b. Sub-tick Simulation
                const tempProjectiles = [];
                const pendingStructures = [];
                const impacts = new Set(); // IDs of entities to be destroyed at turn end

                // 1. Initialize launches
                roundActions.forEach(action => {
                    const player = this.players[action.playerId];
                    const source = this.entities.find(e => e.id === action.sourceId);
                    const cost = GameState.COSTS[action.itemType] || 0;

                    if (player.energy >= cost && source) {
                        player.energy -= cost;
                        if (source.fuel !== undefined) source.fuel--;

                        const rad = (action.angle * Math.PI) / 180;
                        const launchDistance = GameState.calculateLaunchDistance(action.distance);
                        const targetX = this.wrapX(source.x + Math.cos(rad) * launchDistance);
                        const targetY = this.wrapY(source.y + Math.sin(rad) * launchDistance);

                        tempProjectiles.push({
                            id: Math.random().toString(36).substring(2, 6),
                            type: action.itemType,
                            owner: action.playerId,
                            startX: source.x,
                            startY: source.y,
                            currX: source.x,
                            currY: source.y,
                            intendedDx: Math.cos(rad) * launchDistance,
                            intendedDy: Math.sin(rad) * launchDistance,
                            totalDist: launchDistance,
                            active: true
                        });
                    }
                });

                // 2. Simulation Loop
                const subTicks = 120; // High internal resolution for smoothness
                const snapshotStep = 4; // Capture ~30 frames per round

                for (let t = 1; t <= subTicks; t++) {
                    tempProjectiles.forEach(proj => {
                        if (!proj.active) return;

                        const progress = t / subTicks;

                        // Use explicit intended vector to avoid "Shortest Path" directional flips
                        proj.currX = this.wrapX(proj.startX + proj.intendedDx * progress);
                        proj.currY = this.wrapY(proj.startY + proj.intendedDy * progress);

                        if (t === subTicks) {
                            proj.active = false;
                            if (proj.type === 'WEAPON') {
                                // Terminal Collision Logic
                                const hitEnemyHub = this.entities.find(e => {
                                    if (e.type !== 'HUB' || e.owner === proj.owner) return false;
                                    const dist = this.getToroidalDistance(e.x, e.y, proj.currX, proj.currY);
                                    return dist < 30;
                                });

                                if (hitEnemyHub) {
                                    console.log(`[Round ${round}] ${proj.owner} weapon hit ${hitEnemyHub.id}`);
                                    impacts.add(hitEnemyHub.id);
                                }
                            } else {
                                // Structure deployment
                                pendingStructures.push({
                                    type: proj.type,
                                    owner: proj.owner,
                                    x: proj.currX,
                                    y: proj.currY,
                                    sourceId: roundActions.find(a => a.playerId === proj.owner && a.itemType === proj.type)?.sourceId,
                                    intendedDx: proj.intendedDx,
                                    intendedDy: proj.intendedDy
                                });
                            }
                        }
                    });

                    // Capture snapshot periodically
                    if (t % snapshotStep === 0 || t === subTicks) {
                        // We temporarily inject projectiles into entities for the snapshot
                        const snapshotState = this.getState();
                        snapshotState.entities = [
                            ...snapshotState.entities,
                            ...tempProjectiles.filter(p => p.active).map(p => ({
                                id: `proj-${p.id}`,
                                type: 'PROJECTILE',
                                owner: p.owner,
                                x: p.currX,
                                y: p.currY
                            }))
                        ];
                        snapshots.push({
                            type: 'ROUND_SUB',
                            round: round,
                            subTick: t,
                            state: snapshotState
                        });
                    }
                }

                // 3. Final Application of Round Results
                if (impacts.size > 0) {
                    this.entities = this.entities.filter(e => !impacts.has(e.id));
                    this.links = this.links.filter(l => !impacts.has(l.from) && !impacts.has(l.to));
                }

                pendingStructures.forEach(data => {
                    const newEnt = this.addEntity(data);
                    if (data.sourceId && data.intendedDx !== undefined && data.intendedDy !== undefined) {
                        this.addLink(data.sourceId, newEnt.id, data.owner, data.intendedDx, data.intendedDy);
                    }
                });

                // Link Decay check after every round
                this.checkLinkIntegrity();

                snapshots.push({
                    type: 'ROUND',
                    round: round,
                    state: this.getState()
                });
            } else {
                activeInProgress = false;
            }

            // Safety break for infinite loops
            if (round > 20) break;
        }

        // 3. Update Player Status & Check Win Condition
        Object.keys(this.players).forEach(pid => {
            const hasHub = this.entities.some(e => e.owner === pid && e.type === 'HUB');
            if (!hasHub) {
                this.players[pid].alive = false;
            }
        });

        const alivePlayers = Object.keys(this.players).filter(pid => this.players[pid].alive);
        if (alivePlayers.length === 1) {
            this.winner = alivePlayers[0];
        } else if (alivePlayers.length === 0) {
            this.winner = 'DRAW';
        }

        this.turn += 1;

        // Replenish Fuel for the next turn's planning phase
        this.entities.forEach(e => {
            if (e.fuel !== undefined) {
                e.fuel = e.maxFuel;
            }
        });

        snapshots.push({ type: 'FINAL', state: this.getState() });

        return snapshots;
    }

    getState() {
        return {
            turn: this.turn,
            players: { ...this.players },
            entities: [...this.entities],
            links: [...this.links],
            map: this.map,
            winner: this.winner
        };
    }
}
