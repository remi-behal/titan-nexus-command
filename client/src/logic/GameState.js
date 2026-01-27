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
    }

    /**
     * Initialize a new game for a set of players
     */
    initializeGame(playerIds) {
        this.turn = 1;
        this.entities = [];
        this.links = [];
        this.players = {};

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
        const id = btoa(Math.random()).substring(0, 8); // Simple unique ID
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
        // 1. Generate Energy for all hubs/extractors
        Object.keys(this.players).forEach(pid => {
            // Base generation
            this.players[pid].energy += 10;

            // TODO: Bonus energy from extractors
        });

        // 2. Process Actions (Launches)
        playerActions.forEach(action => {
            const player = this.players[action.playerId];
            if (!player || player.energy < 20) return; // Cost check

            player.energy -= 20; // Generic cost for now

            // Calculate destination based on angle and distance
            const rad = (action.angle * Math.PI) / 180;
            const targetX = action.sourceX + Math.cos(rad) * action.distance;
            const targetY = action.sourceY + Math.sin(rad) * action.distance;

            // Add the new entity
            const newEntity = this.addEntity({
                type: action.itemType,
                owner: action.playerId,
                x: targetX,
                y: targetY,
                hp: 50
            });

            // Link it to the source
            this.addLink(action.sourceId, newEntity.id);
        });

        this.turn += 1;
        return this.getState();
    }

    getState() {
        // Return a clean object for React to use
        return {
            turn: this.turn,
            players: { ...this.players },
            entities: [...this.entities],
            links: [...this.links],
            map: this.map
        };
    }
}
