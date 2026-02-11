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
            const startX = 400 + (index * 400); // Rough spread for now
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
            { id: 'res2', x: 1000, y: 700, value: 10 }
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
            maxFuel: initialFuel
        };
        this.entities.push(entity);
        return entity;
    }

    addLink(fromId, toId) {
        this.links.push({ from: fromId, to: toId });
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
                        // Source destroyed OR out of fuel!
                        const reason = !source ? 'destroyed' : 'out of fuel';
                        console.log(`[Round ${round}] ${pid} action skipped (Source ${action.sourceId} ${reason}). Sliding...`);
                        actionPointers[pid]++;
                    }
                }

            });

            if (roundActions.length > 0) {
                console.log(`[Round ${round}] Executing ${roundActions.length} simultaneous actions.`);

                // Simultaneous execution: All actions in this round succeed together (Revenge Logic)
                roundActions.forEach(action => {
                    const player = this.players[action.playerId];
                    const source = this.entities.find(e => e.id === action.sourceId);
                    const cost = GameState.COSTS[action.itemType] || 0;

                    if (player.energy >= cost && source && (source.fuel === undefined || source.fuel > 0)) {
                        player.energy -= cost;
                        if (source.fuel !== undefined) source.fuel--;

                        const rad = (action.angle * Math.PI) / 180;
                        // Use the authoritative non-linear math to find the target
                        const launchDistance = GameState.calculateLaunchDistance(action.distance);
                        const targetX = action.sourceX + Math.cos(rad) * launchDistance;
                        const targetY = action.sourceY + Math.sin(rad) * launchDistance;

                        // Collision Logic
                        const hitEnemyHub = this.entities.find(e => {
                            if (e.type !== 'HUB' || e.owner === action.playerId) return false;
                            const dist = Math.sqrt((e.x - targetX) ** 2 + (e.y - targetY) ** 2);
                            return dist < 30; // Hit radius
                        });

                        if (hitEnemyHub) {
                            console.log(`[Round ${round}] SUCCESS: ${action.playerId} hit ${hitEnemyHub.id}`);
                            this.entities = this.entities.filter(e => e.id !== hitEnemyHub.id);
                            // Also remove links to/from this hub
                            this.links = this.links.filter(l => l.from !== hitEnemyHub.id && l.to !== hitEnemyHub.id);
                        } else {
                            // Add the new entity if we didn't hit and destroy something
                            const newEntity = this.addEntity({
                                type: action.itemType,
                                owner: action.playerId,
                                x: targetX,
                                y: targetY,
                                hp: 50
                            });
                            this.addLink(action.sourceId, newEntity.id);
                        }
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
                // No more valid actions could be found for anyone
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
