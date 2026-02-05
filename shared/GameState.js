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
                hp: 100
            });
        });

        // Mock some resource nodes
        this.map.resources = [
            { id: 'res1', x: 500, y: 300, value: 10 },
            { id: 'res2', x: 1000, y: 700, value: 10 }
        ];
    }

    addEntity(data) {
        const id = Math.random().toString(36).substring(2, 10); // Node-friendly unique ID
        const entity = { id, ...data };
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
    resolveTurn(playerActions) {
        if (this.winner) return this.getState();

        // 1. Generate Energy for all hubs/extractors
        Object.keys(this.players).forEach(pid => {
            if (!this.players[pid].alive) return;
            this.players[pid].energy += 10;
        });

        // 2. Process Actions (Launches)
        playerActions.forEach(action => {
            const player = this.players[action.playerId];
            if (!player || !player.alive) return;

            const cost = GameState.COSTS[action.itemType] || 0;
            if (player.energy < cost) {
                console.log(`Action rejected: Player ${action.playerId} insufficient energy (${player.energy} < ${cost})`);
                return;
            }

            player.energy -= cost;

            const rad = (action.angle * Math.PI) / 180;
            // Use the authoritative non-linear math to find the target
            const launchDistance = GameState.calculateLaunchDistance(action.distance);
            const targetX = action.sourceX + Math.cos(rad) * launchDistance;
            const targetY = action.sourceY + Math.sin(rad) * launchDistance;

            // SIMPLE COLLISION/DESTRUCTION LOGIC FOR TESTING
            // If we land near an enemy HUB, destroy it
            const hitEnemyHub = this.entities.find(e => {
                if (e.type !== 'HUB' || e.owner === action.playerId) return false;
                const dist = Math.sqrt((e.x - targetX) ** 2 + (e.y - targetY) ** 2);
                return dist < 30; // Hit radius
            });

            if (hitEnemyHub) {
                // Destroy the hub
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
        });

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
        return this.getState();
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
