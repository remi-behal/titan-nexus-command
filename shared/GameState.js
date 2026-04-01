/**
 * GameState.js
 *
 * This class represents the "Single Source of Truth" for your game world.
 * It is designed to be "headless", meaning it doesn't care about rendering
 * or UI. This makes it easy to move to the server later!
 */

import { ENTITY_STATS, GLOBAL_STATS, RESOURCE_NODE_STATS } from './constants/EntityStats.js';

export class GameState {
    constructor() {
        this.turn = 1;
        this.players = {}; // { playerId: { energy: 100, color: 'red', alive: true } }
        this.entities = []; // [ { id, type: 'HUB', owner, x, y, hp } ]
        this.links = []; // [ { fromId, toId } ]
        this.map = {
            width: GLOBAL_STATS.MAP_WIDTH,
            height: GLOBAL_STATS.MAP_HEIGHT,
            resources: [], // Energy nodes on the map
            obstacles: [], // Rocks, walls, etc.
            lakes: [],
            mountains: []
        };
        this.winner = null;
        this.phase = 'PLANNING'; // 'PLANNING' or 'RESOLVING'
    }

    /**
     * Non-linear power curve math
     * Given a raw pull distance, returns the tactical launch distance.
     */
    static calculateLaunchDistance(pullDistance) {
        const clampedPull = Math.min(pullDistance, GLOBAL_STATS.MAX_PULL);
        const ratio = clampedPull / GLOBAL_STATS.MAX_PULL;
        // Exponential curve: precision at low power, high sensitivity at high power
        return Math.pow(ratio, GLOBAL_STATS.POWER_EXPONENT) * GLOBAL_STATS.MAX_LAUNCH;
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
     * Checks if a line segment (x1, y1) -> (x2, y2) intersects a circle (cx, cy, radius).
     * Accounts for toroidal wrapping by normalizing relative to the circle center.
     */
    static lineCircleIntersection(x1, y1, x2, y2, cx, cy, radius, w, h) {
        // Step 1: Get vectors from circle center to segment endpoints
        const v1 = this.getToroidalVector(cx, cy, x1, y1, w, h);
        const v2 = this.getToroidalVector(cx, cy, x2, y2, w, h);

        // Coordinates relative to cx=0, cy=0
        const p1x = v1.dx;
        const p1y = v1.dy;
        const p2x = v2.dx;
        const p2y = v2.dy;

        const d_x = p2x - p1x;
        const d_y = p2y - p1y;

        const lensq = d_x * d_x + d_y * d_y;
        let t = 0;
        if (lensq > 0) {
            // Project origin (circle center) onto the line segment: t = dot(-P1, D) / |D|^2
            t = Math.max(0, Math.min(1, (-p1x * d_x + -p1y * d_y) / lensq));
        }

        const closestX = p1x + t * d_x;
        const closestY = p1y + t * d_y;
        const distSq = closestX * closestX + closestY * closestY;

        return distSq <= radius * radius;
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
    isPositionVisible(playerId, x, y, entities = null) {
        if (!playerId || playerId === 'spectator') return true;

        const sourceEntities = entities || this.entities;
        return sourceEntities.some((e) => {
            if (e.owner !== playerId) return false;

            // Correctly identify stat key for buildings vs projectiles
            const statKey =
                (e.type === 'PROJECTILE' ||
                    e.type === 'WEAPON' ||
                    e.type === 'HOMING_MISSILE' ||
                    e.type === 'SAM_MISSILE') &&
                    e.itemType
                    ? e.itemType
                    : e.type;
            const stats = ENTITY_STATS[statKey];
            const radius = e.vision !== undefined ? e.vision : stats?.vision || 0;
            if (radius === 0) return false;

            const dist = this.getToroidalDistance(e.x, e.y, x, y);
            if (dist > radius) return false;

            // Projectile-Specific Vision Override: 60 degree cone
            // NOTE: A projectile ALWAYS sees its own position (dist < 1)
            if (
                dist > 1 &&
                (e.type === 'PROJECTILE' || e.type === 'HOMING_MISSILE') &&
                (e.itemType === 'HOMING_MISSILE' || e.type === 'HOMING_MISSILE')
            ) {
                const vec = this.constructor.getToroidalVector(
                    e.x,
                    e.y,
                    x,
                    y,
                    this.map.width,
                    this.map.height
                );
                const angleToPoint = Math.atan2(vec.dy, vec.dx) * (180 / Math.PI);

                let diff = angleToPoint - (e.currentAngle || 0);
                while (diff > 180) diff -= 360;
                while (diff < -180) diff += 360;

                return Math.abs(diff) <= (stats.searchCone || 60) / 2;
            }

            return true;
        });
    }

    /**
     * Returns a list of vision circles { x, y, radius } for a given player.
     */
    getVisionCircles(playerId) {
        if (!playerId || playerId === 'spectator') return [];

        return this.entities
            .filter((e) => e.owner === playerId)
            .map((e) => ({
                x: e.x,
                y: e.y,
                radius: ENTITY_STATS[e.type]?.vision || 0
            }))
            .filter((c) => c.radius > 0);
    }

    /**
     * Returns a filtered version of the state based on what a player can see.
     * @param {string} playerId - The player requesting the state.
     * @param {object} [baseState] - Optional state object to filter (defaults to current state).
     */
    getVisibleState(playerId, baseState = null) {
        const state = baseState ? JSON.parse(JSON.stringify(baseState)) : this.getState();
        if (!playerId || playerId === 'spectator') {
            state.entities = state.entities.map((e) => ({ ...e, scouted: true }));
            return state;
        }

        const isVisible = (x, y) => {
            return this.isPositionVisible(playerId, x, y, state.entities);
        };

        const entitiesRequiredByLinks = new Set();

        // Filter links: visible if either end is visible, or if any segment is visible
        const sourceEntities = baseState ? baseState.entities : this.entities;

        state.links = state.links.filter((l) => {
            const fullFrom = sourceEntities.find((e) => e.id === l.from);
            const fullTo = sourceEntities.find((e) => e.id === l.to);
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
                if (Math.abs(dx) > state.map.width / 2)
                    dx = dx > 0 ? dx - state.map.width : dx + state.map.width;
                if (Math.abs(dy) > state.map.height / 2)
                    dy = dy > 0 ? dy - state.map.height : dy + state.map.height;
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
        state.entities = sourceEntities
            .map((e) => {
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
            })
            .filter((e) => e !== null);

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
                energy: GLOBAL_STATS.STARTING_ENERGY, // Starting energy
                color: `hsl(${index * 60}, 70%, 50%)`,
                alive: true
            };

            // Create initial Hub for each player
            const startX = 250 + index * 500; // Spread at 25% and 75% width
            const startY = 500;

            this.addEntity({
                type: 'HUB',
                owner: id,
                x: startX,
                y: startY,
                hp: ENTITY_STATS.HUB.hp,
                isStarter: true
            });
        });

        // Mock resource nodes (Standard: 5 bonus, Super: 15 bonus)
        const { STANDARD, SUPER } = RESOURCE_NODE_STATS;
        this.map.resources = [
            { id: 'res1', x: 500, y: 250, ...STANDARD }, // Top quadrant
            { id: 'res2', x: 1500, y: 750, ...STANDARD }, // Bottom quadrant
            { id: 'res3', x: 1000, y: 500, ...SUPER }, // Super node (Center)
            { id: 'res4', x: 1000, y: 1500, ...STANDARD } // Far side
        ];

        // Seed a test lake (Phase 6)
        this.map.lakes = [{ id: 'lake1', x: 1000, y: 560, radius: 100 }];

        // Seed a mountain range (Phase 6)
        this.map.mountains = [
            { id: 'mtn1', x: 1200, y: 1500, radius: 100 },
            { id: 'mtn2', x: 1350, y: 1500, radius: 100 },
            { id: 'mtn3', x: 1500, y: 1500, radius: 100 }
        ];
    }

    /**
     * Link Decay: Any structure not connected (via links) to
     * its player's starter hub is destroyed.
     */
    checkLinkIntegrity(round = 0) {
        const toDestroy = new Set();

        Object.keys(this.players).forEach((pid) => {
            const connected = new Set();
            const starter = this.entities.find((e) => e.owner === pid && e.isStarter);

            if (starter) {
                const queue = [starter.id];
                connected.add(starter.id);

                while (queue.length > 0) {
                    const currentId = queue.shift();
                    // Find all entities linked to this one
                    this.links.forEach((link) => {
                        let neighborId = null;
                        if (link.from === currentId) neighborId = link.to;
                        if (link.to === currentId) neighborId = link.from;

                        if (neighborId && !connected.has(neighborId)) {
                            const neighbor = this.entities.find((e) => e.id === neighborId);
                            if (neighbor && neighbor.owner === pid) {
                                connected.add(neighborId);
                                queue.push(neighborId);
                            }
                        }
                    });
                }
            } else {
                console.log(
                    `[Link Decay] Player ${pid} has no starter hub. All structures orphaned.`
                );
            }

            // Mark for destruction all entities owned by this player that aren't in 'connected'
            this.entities.forEach((e) => {
                // Hazards are temporary and don't need to be linked to the hub
                const isOrphan =
                    e.owner === pid &&
                    !connected.has(e.id) &&
                    !e.isHazard &&
                    e.type !== 'EXPLOSION_HAZARD';
                if (isOrphan) {
                    console.log(
                        `[LinkDecay-DEBUG] Round ${round}: Orphaned structure ${e.id} (${e.type})`
                    );
                    toDestroy.add(e.id);
                }
            });
        });

        if (toDestroy.size > 0) {
            console.log(
                `[Link Decay] Destroying orphaned entities: ${Array.from(toDestroy).join(', ')}`
            );
            this.entities = this.entities.filter((e) => !toDestroy.has(e.id));
            this.links = this.links.filter((l) => !toDestroy.has(l.from) && !toDestroy.has(l.to));
        }
    }

    /**
     * Map Hazard Conflict Resolution (Phase 6)
     * Handles Lakes (drowning + link blockage) and Mountains (crashing only)
     */
    checkMapHazards(tempVisuals = []) {
        // 1. Process Lakes
        if (this.map.lakes && this.map.lakes.length > 0) {
            this.map.lakes.forEach((lake) => {
                // Stage 1: Entity Drowning
                this.entities.forEach((entity) => {
                    const dist = this.getToroidalDistance(entity.x, entity.y, lake.x, lake.y);
                    if (dist < lake.radius) {
                        entity.hp = 0;
                        console.log(
                            `[Lake] ${entity.id} (${entity.type}) drowned at (${Math.round(entity.x)}, ${Math.round(entity.y)})`
                        );
                    }
                });

                // Stage 2: Link Blockage
                const linksToDestroy = new Set();
                this.links.forEach((link) => {
                    const s1 = this.entities.find((e) => e.id === link.from);
                    const s2 = this.entities.find((e) => e.id === link.to);
                    if (!s1 || !s2) return;

                    const segments = GameState.getLinkSegments(
                        { x: s1.x, y: s1.y },
                        { x: s2.x, y: s2.y },
                        this.map.width,
                        this.map.height
                    );

                    segments.forEach((seg) => {
                        const dist = GameState.getPointToSegmentDistance(
                            lake.x,
                            lake.y,
                            seg.p1.x,
                            seg.p1.y,
                            seg.p2.x,
                            seg.p2.y
                        );
                        if (dist < lake.radius) {
                            linksToDestroy.add(link.to);

                            // Add visual effect at the point where link segments are closest to lake center
                            const proj = GameState.getPointOnSegment(
                                lake.x,
                                lake.y,
                                seg.p1.x,
                                seg.p1.y,
                                seg.p2.x,
                                seg.p2.y
                            );
                            tempVisuals.push({
                                type: 'LINK_COLLISION',
                                x: proj.x,
                                y: proj.y,
                                duration: 30
                            });

                            console.log(
                                `[Lake] Link ${link.from}->${link.to} crosses lake volume! Breaking.`
                            );
                        }
                    });
                });

                linksToDestroy.forEach((id) => {
                    const ent = this.entities.find((e) => e.id === id);
                    if (ent) ent.hp = 0;
                });
            });
        }

        // 2. Process Mountains
        if (this.map.mountains && this.map.mountains.length > 0) {
            this.map.mountains.forEach((mtn) => {
                // Entity Crashing (Wait for landing)
                this.entities.forEach((entity) => {
                    const dist = this.getToroidalDistance(entity.x, entity.y, mtn.x, mtn.y);
                    if (dist < mtn.radius) {
                        entity.hp = 0;
                        console.log(
                            `[Mountain] ${entity.id} (${entity.type}) crashed into mountain at (${Math.round(entity.x)}, ${Math.round(entity.y)})`
                        );
                    }
                });
                // Note: Links CAN cross mountains, so no link check here.
            });
        }

        // 3. Process Craters (Permanent scars)
        if (this.map.craters && this.map.craters.length > 0) {
            this.map.craters.forEach((crater) => {
                this.entities.forEach((entity) => {
                    const dist = this.getToroidalDistance(entity.x, entity.y, crater.x, crater.y);
                    if (dist < crater.radius) {
                        entity.hp = 0;
                        console.log(
                            `[Crater] ${entity.id} (${entity.type}) crashed into crater at (${Math.round(entity.x)}, ${Math.round(entity.y)})`
                        );
                    }
                });
            });
        }
    }

    /**
     * Structure Collision & Overlap Detection (Phase 6)
     * Rule A: Simultaneous landing overlap (both destroyed)
     * Rule B: Crash on existing structure (destroy landing, damage existing)
     */
    checkStructureCollisions(tempVisuals = []) {
        const newEntities = this.entities.filter((e) => e.deployed === false);
        const existingEntities = this.entities.filter((e) => e.deployed !== false);
        const toDestroy = new Set();

        newEntities.forEach((newEnt) => {
            const nr = ENTITY_STATS[newEnt.type]?.size || 20;

            // 1. Rule B: Crash on existing structure (already deployed)
            existingEntities.forEach((oldEnt) => {
                const or = ENTITY_STATS[oldEnt.type]?.size || 20;
                const dist = this.getToroidalDistance(newEnt.x, newEnt.y, oldEnt.x, oldEnt.y);
                if (dist < nr + or) {
                    toDestroy.add(newEnt.id);
                    oldEnt.hp -= 1; // 1 Crash damage to existing
                    tempVisuals.push({
                        type: 'LINK_COLLISION',
                        x: oldEnt.x,
                        y: oldEnt.y,
                        duration: 30
                    });
                    console.log(
                        `[Collision] Rule B: ${newEnt.type} crashed into ${oldEnt.type} upon landing!`
                    );
                }
            });

            // 2. Rule A: Simultaneous landing overlap (Other new structures)
            newEntities.forEach((otherNew) => {
                if (newEnt.id === otherNew.id) return;
                const or = ENTITY_STATS[otherNew.type]?.size || 20;
                const dist = this.getToroidalDistance(newEnt.x, newEnt.y, otherNew.x, otherNew.y);

                if (dist < nr + or) {
                    toDestroy.add(newEnt.id);
                    toDestroy.add(otherNew.id);

                    // Add visual effect at the midpoint (toroidal-aware)
                    const vector = GameState.getToroidalVector(
                        newEnt.x,
                        newEnt.y,
                        otherNew.x,
                        otherNew.y,
                        this.map.width,
                        this.map.height
                    );
                    tempVisuals.push({
                        type: 'LINK_COLLISION',
                        x: this.wrapX(newEnt.x + vector.dx / 2),
                        y: this.wrapY(newEnt.y + vector.dy / 2),
                        duration: 30
                    });

                    console.log(
                        `[Collision] Rule A: ${newEnt.type} and ${otherNew.type} overlapped upon landing!`
                    );
                }
            });
        });

        toDestroy.forEach((id) => {
            const ent = this.entities.find((e) => e.id === id);
            if (ent) ent.hp = 0;
        });
    }

    addEntity(data) {
        const id = Math.random().toString(36).substring(2, 10); // Node-friendly unique ID

        // Centralized Stat Lookups
        const stats = ENTITY_STATS[data.type] || {};
        const defaultFuel = stats.fuel;

        const finalFuel = data.fuel !== undefined ? data.fuel : defaultFuel;
        const finalMaxFuel = data.maxFuel !== undefined ? data.maxFuel : defaultFuel;

        const entity = {
            id,
            ...data,
            fuel: finalFuel,
            maxFuel: finalMaxFuel,
            hp: data.hp || stats.hp || GLOBAL_STATS.DEFAULT_HP
        };

        if (data.type === 'NUKE' && data.detonationTurn === undefined) {
            entity.detonationTurn = this.turn + 2;
        }

        if (data.type === 'ECHO_ARTILLERY') {
            entity.pendingEchos = []; // [{ x, y }] targets to fire at in the next round
            entity.firedThisTurn = false;
        }

        if (data.type === 'SHIELD') {
            entity.barrierHp = stats.barrierHpMax || 5;
        }

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
        console.log('--- RESOLVE TURN ---', JSON.stringify(playerActionsMap));
        this.phase = 'RESOLVING';
        const snapshots = [];
        if (this.winner) {
            snapshots.push({ type: 'FINAL', state: this.getState() });
            return snapshots;
        }

        // 0. Cleanup Expired Hazards & Map Scarring (Craters)
        this.entities = this.entities.filter((e) => {
            const isHazard = e.type === 'EXPLOSION_HAZARD' || e.type === 'NAPALM_FIRE';
            if (isHazard && e.expiresTurn < this.turn) {
                if (!this.map.craters) this.map.craters = [];
                // Leave a permanent mark on the map
                if (e.type === 'EXPLOSION_HAZARD') {
                    this.map.craters.push({
                        id: `crater-${Math.random().toString(36).substring(2, 7)}`,
                        x: e.x,
                        y: e.y,
                        radius: 40
                    });
                    console.log(
                        `[Scarring] Hazard at (${e.x}, ${e.y}) subsided, leaving a crater.`
                    );
                } else {
                    console.log(`[Lifecycle] ${e.type} at (${e.x}, ${e.y}) subsided.`);
                }
                return false;
            }
            return true;
        });

        // 0.5 Reset Echo Artillery for new turn
        this.entities.forEach((ent) => {
            if (ent.type === 'ECHO_ARTILLERY') {
                ent.firedThisTurn = false;
                ent.pendingEchos = []; // Clear any leftover echos from previous turn
            }
            if (ent.type === 'SHIELD') {
                const stats = ENTITY_STATS.SHIELD;
                ent.barrierHp = Math.min(
                    stats.barrierHpMax,
                    (ent.barrierHp || 0) + (stats.rechargeRate || 1)
                );
            }
        });

        // 1. Generate Energy for all active players
        Object.keys(this.players).forEach((pid) => {
            if (!this.players[pid].alive) return;

            let turnIncome = GLOBAL_STATS.ENERGY_INCOME_PER_TURN; // Base UBI

            // Add income from entities (Hubs and Extractors)
            this.entities.forEach((entity) => {
                if (entity.owner === pid) {
                    const stats = ENTITY_STATS[entity.type];
                    if (stats && stats.energyGen) {
                        let entityIncome = stats.energyGen;

                        // Extractor-specific node bonus
                        // We check if the extractor is within the capture radius of any resource node.
                        if (entity.type === 'EXTRACTOR') {
                            // Find the closest node in range (toroidal-aware)
                            const node = this.map.resources.find(
                                (res) =>
                                    this.getToroidalDistance(entity.x, entity.y, res.x, res.y) <=
                                    GLOBAL_STATS.RESOURCE_CAPTURE_RADIUS
                            );
                            if (node) {
                                // The node's 'value' acts as a multiplier or flat bonus to energy production
                                entityIncome += node.value || 0;
                                console.log(
                                    `[Economy] Extractor ${entity.id} on node ${node.id} generated ${entityIncome} total.`
                                );
                            }
                        }

                        turnIncome += entityIncome;
                    }
                }
            });

            this.players[pid].energy += turnIncome;
            console.log(`[Economy] ${pid} total turn income: ${turnIncome}`);
        });
        snapshots.push({ type: 'ENERGY', state: this.getState() });

        const nukeImpacts = new Set();
        const nukeVisuals = [];
        const possibleNukes = [...this.entities];
        possibleNukes.forEach((e) => {
            if (e.type === 'NUKE' && e.detonationTurn <= this.turn) {
                console.log(`[Lifecycle] Nuke ${e.id} detonating on Turn ${this.turn}!`);
                const stats = ENTITY_STATS.NUKE;
                this.triggerExplosion(e.x, e.y, stats, nukeVisuals, nukeImpacts, this.entities);

                // Spawn Lingering Hazard (lasts remainder of this Turn)
                this.addEntity({
                    type: 'EXPLOSION_HAZARD',
                    x: e.x,
                    y: e.y,
                    owner: e.owner,
                    expiresTurn: this.turn,
                    hp: 999,
                    deployed: true,
                    isHazard: true
                });
            }
        });

        if (nukeImpacts.size > 0) {
            this.entities = this.entities.filter((e) => !nukeImpacts.has(e.id));
            this.links = this.links.filter(
                (l) => !nukeImpacts.has(l.from) && !nukeImpacts.has(l.to)
            );
            snapshots.push({
                type: 'DETONATION',
                state: this.getState(),
                visuals: nukeVisuals
            });
        }

        // 2. Process Actions with Entity-Autonomous "One-per-Hub-per-Round" Logic
        const playerIds = Object.keys(this.players);
        const processedActions = {}; // Indices of actions already resolved or discarded
        playerIds.forEach((pid) => (processedActions[pid] = new Set()));

        let round = 0;
        let activeInProgress = true;

        while (
            activeInProgress ||
            this.entities.some(
                (e) => e.type === 'NAPALM_FIRE' && (e.roundsLeft === undefined || e.roundsLeft > 0)
            ) ||
            this.entities.some(
                (e) => e.type === 'ECHO_ARTILLERY' && e.pendingEchos && e.pendingEchos.length > 0
            )
        ) {
            round++;
            const roundActions = [];
            const automaticProjectiles = [];
            const overloadedThisRound = new Set();

            // Task 3: Collect Echo Artillery retaliation
            this.entities.forEach((echo) => {
                if (
                    echo.type === 'ECHO_ARTILLERY' &&
                    echo.pendingEchos &&
                    echo.pendingEchos.length > 0
                ) {
                    // Filter echos ready for this round (1-round delay)
                    const readyEchos = echo.pendingEchos.filter((pea) => pea.triggerRound < round);
                    echo.pendingEchos = echo.pendingEchos.filter(
                        (pea) => pea.triggerRound >= round
                    );

                    readyEchos.forEach((target) => {
                        const stats = ENTITY_STATS.WEAPON; // Standard Dumb Bomb
                        const velocity = stats.speed || GLOBAL_STATS.SPEED_TIERS.NORMAL;

                        // Calculate angle and distance to source structure
                        const { dx, dy } = GameState.getToroidalVector(
                            echo.x,
                            echo.y,
                            target.x,
                            target.y,
                            this.map.width,
                            this.map.height
                        );
                        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
                        let distance = Math.sqrt(dx * dx + dy * dy);

                        // Add Inaccuracy (Deviation)
                        const aStats = ENTITY_STATS.ECHO_ARTILLERY;
                        angle += (Math.random() - 0.5) * (aStats.accuracyDeviationAngle || 0);
                        distance *=
                            1 -
                            (aStats.accuracyDeviationDistance || 0) / 2 +
                            Math.random() * (aStats.accuracyDeviationDistance || 0);

                        const rad = (angle * Math.PI) / 180;
                        const arrivalTick = Math.max(1, Math.floor(distance / velocity));

                        automaticProjectiles.push({
                            id: Math.random().toString(36).substring(2, 6),
                            type: 'WEAPON', // Echo Shell = Dumb Bomb
                            itemType: 'WEAPON',
                            owner: echo.owner,
                            startX: echo.x,
                            startY: echo.y,
                            currX: echo.x,
                            currY: echo.y,
                            currentAngle: angle,
                            sourceId: echo.id,
                            intendedDx: Math.cos(rad) * distance,
                            intendedDy: Math.sin(rad) * distance,
                            originalTargetX: this.wrapX(echo.x + Math.cos(rad) * distance),
                            originalTargetY: this.wrapY(echo.y + Math.sin(rad) * distance),
                            totalDist: distance,
                            intendedDistance: distance,
                            arrivalTick: arrivalTick,
                            velocity: velocity,
                            totalDistanceMoved: 0,
                            active: true,
                            hp: stats.hp || 1,
                            hitByFlakDefense: new Set()
                        });
                        console.log(
                            `[Echo-Firing] Artillery ${echo.id} firing retaliation at (${Math.round(target.x)}, ${Math.round(target.y)})`
                        );

                        // TASK 5: Automated launches also trigger other Echo Artilleries
                        this.triggerEchoArtillery(echo.x, echo.y, echo.owner, round);
                    });
                }
            });

            // a. Collection: Find the next valid action for each UNIQUE hub of this player
            playerIds.forEach((pid) => {
                const actions = playerActionsMap[pid] || [];
                const hubsFiredThisRound = new Set();

                for (let i = 0; i < actions.length; i++) {
                    if (processedActions[pid].has(i)) continue;

                    const action = actions[i];
                    const source = this.entities.find((e) => e.id === action.sourceId);

                    // Discard invalid actions (source destroyed or out of fuel)
                    if (!source || (source.fuel !== undefined && source.fuel <= 0)) {
                        processedActions[pid].add(i);
                        continue;
                    }

                    // Strict Rule: One action per unique Hub per round
                    if (!hubsFiredThisRound.has(action.sourceId)) {
                        roundActions.push(action);
                        hubsFiredThisRound.add(action.sourceId);
                        processedActions[pid].add(i);
                    }
                }
            });

            const hasActiveHazards = this.entities.some(
                (e) =>
                    (e.type === 'NAPALM_FIRE' &&
                        (e.roundsLeft === undefined || e.roundsLeft > 0)) ||
                    (e.type === 'EXPLOSION_HAZARD' && round === 1)
            );
            if (roundActions.length > 0 || hasActiveHazards || automaticProjectiles.length > 0) {
                const subTicks = GLOBAL_STATS.ACTION_SUB_TICKS;

                // b. Sub-tick Simulation
                const tempProjectiles = [...automaticProjectiles];
                const impacts = new Set(); // IDs of entities to be destroyed at turn end
                const tempVisuals = []; // Visual effects for this round (beams, explosions)

                // 1. Initialize launches
                roundActions.forEach((action) => {
                    const player = this.players[action.playerId];
                    const source = this.entities.find((e) => e.id === action.sourceId);
                    const cost = ENTITY_STATS[action.itemType]?.cost || 0;

                    if (player.energy >= cost && source) {
                        player.energy -= cost;
                        if (source.fuel !== undefined) source.fuel--;

                        let launchDistance = GameState.calculateLaunchDistance(action.distance);
                        const stats = ENTITY_STATS[action.itemType];
                        const velocity = stats.speed || GLOBAL_STATS.SPEED_TIERS.SLOW;
                        let actualLaunchDistance = launchDistance;

                        // Napalm Refinement: Projectile stops 150px short of the target
                        if (action.itemType === 'NAPALM') {
                            // Bug 1: Enforce minRange (clamped to 200px from launcher)
                            const effectiveLaunchDist = Math.max(
                                stats.minRange || 0,
                                launchDistance
                            );
                            actualLaunchDistance = Math.max(10, effectiveLaunchDist - 150);

                            // If distance was clamped, we need to update launchDistance for originalTargetX/Y calc later
                            launchDistance = effectiveLaunchDist;
                        }

                        const arrivalTick = Math.max(
                            1,
                            Math.floor(actualLaunchDistance / velocity)
                        );
                        const rad = (action.angle * Math.PI) / 180;

                        console.log(
                            `[Launch] ${action.playerId} launching ${action.itemType} from ${action.sourceId} to distance ${actualLaunchDistance} (arrivalTick: ${arrivalTick})`
                        );
                        tempProjectiles.push({
                            id: Math.random().toString(36).substring(2, 6),
                            type: action.itemType,
                            itemType: action.itemType,
                            owner: action.playerId,
                            startX: source.x,
                            startY: source.y,
                            currX: source.x,
                            currY: source.y,
                            currentAngle: action.angle,
                            sourceId: action.sourceId,
                            intendedDx: Math.cos(rad) * actualLaunchDistance,
                            intendedDy: Math.sin(rad) * actualLaunchDistance,
                            // Store original target for fire extension logic
                            originalTargetX: this.wrapX(source.x + Math.cos(rad) * launchDistance),
                            originalTargetY: this.wrapY(source.y + Math.sin(rad) * launchDistance),
                            totalDist: actualLaunchDistance,
                            intendedDistance: actualLaunchDistance,
                            pullDistance: action.distance,
                            arrivalTick: arrivalTick,
                            velocity: velocity,
                            totalDistanceMoved: 0,
                            searchMode: false,
                            targetId: null,
                            lockFound: false,
                            hp:
                                stats.damageFull !== undefined || stats.isInterceptor
                                    ? stats.hp || 1
                                    : GLOBAL_STATS.UNDEPLOYED_HP,
                            active: true,
                            hitByFlakDefense: new Set(), // Track unique flak hits per round
                            hasSplit: false
                        });
                        console.log(
                            `[Launch] ${action.playerId} fired ${action.itemType} from ${source.id}`
                        );

                        // Task 5: Use extracted detection logic for manual launches
                        this.triggerEchoArtillery(source.x, source.y, action.playerId, round);
                    }
                });

                snapshots.push({
                    type: 'ROUND_START',
                    round: round,
                    state: this.getState()
                });

                // 2. Simulation Loop
                const snapshotStep = Math.max(1, Math.floor(subTicks / 30)); // Dynamically scale snapshots

                // OPTIMIZATION: Skip the expensive simulation loop and snapshot generation if nothing is moving
                const hasActiveSimulation =
                    tempProjectiles.length > 0 ||
                    roundActions.length > 0 ||
                    tempVisuals.length > 0 ||
                    hasActiveHazards;

                if (hasActiveSimulation) {
                    for (let t = 1; t <= subTicks; t++) {
                        // --- Interception Logic ---
                        this.entities.forEach((def) => {
                            const isDefense =
                                def.type === 'LASER_POINT_DEFENSE' ||
                                def.type === 'LIGHT_SAM_DEFENSE' ||
                                def.type === 'FLAK_DEFENSE';
                            if (isDefense && def.fuel > 0 && def.deployed !== false) {
                                // ROF Limit: 1 interception per round
                                if (def.lastRoundFired === round) return;

                                // Flak logic: If already active, it doesn't need to re-trigger or search
                                if (def.type === 'FLAK_DEFENSE' && def.flakActive) {
                                    return;
                                }

                                // Find closest active enemy projectile in range
                                let closestProj = null;
                                const stats = ENTITY_STATS[def.type];
                                let minDist = stats.range;

                                tempProjectiles.forEach((proj) => {
                                    if (!proj.active || proj.owner === def.owner) return;

                                    const pStats =
                                        ENTITY_STATS[proj.type] || ENTITY_STATS[proj.itemType];
                                    if (pStats?.isInterceptable === false) return;

                                    const dist = this.getToroidalDistance(
                                        def.x,
                                        def.y,
                                        proj.currX,
                                        proj.currY
                                    );
                                    // Deterministic Tie-break: if distances are equal, pick by ID (lexicographical)
                                    if (
                                        dist < minDist ||
                                        (dist === minDist &&
                                            (!closestProj || proj.id < closestProj.id))
                                    ) {
                                        minDist = dist;
                                        closestProj = proj;
                                    }
                                });

                                if (closestProj) {
                                    // Mark as fired this round
                                    def.lastRoundFired = round;

                                    if (def.type === 'LASER_POINT_DEFENSE') {
                                        // Laser Intercept!
                                        closestProj.active = false;
                                        def.fuel--;

                                        // Calculate toroidal-aware visual coordinates
                                        const vec = this.constructor.getToroidalVector(
                                            def.x,
                                            def.y,
                                            closestProj.currX,
                                            closestProj.currY,
                                            this.map.width,
                                            this.map.height
                                        );

                                        // Create visual beam
                                        tempVisuals.push({
                                            type: 'LASER_BEAM',
                                            x: def.x,
                                            y: def.y,
                                            targetX: def.x + vec.dx,
                                            targetY: def.y + vec.dy,
                                            duration: Math.max(5, Math.floor(subTicks / 8))
                                        });
                                        console.log(
                                            `[Intercept] ${def.id} (Laser) blocked projectile from ${closestProj.owner}`
                                        );
                                    } else if (def.type === 'FLAK_DEFENSE') {
                                        // Flak Activation!
                                        def.flakActive = true;
                                        def.flakTriggerTick = t;
                                        def.fuel--;

                                        const vec = this.constructor.getToroidalVector(
                                            def.x,
                                            def.y,
                                            closestProj.currX,
                                            closestProj.currY,
                                            this.map.width,
                                            this.map.height
                                        );
                                        def.flakAngle =
                                            Math.atan2(vec.dy, vec.dx) * (180 / Math.PI);

                                        console.log(
                                            `[Flak Activation] ${def.id} triggered at ${Math.round(def.flakAngle)} degrees`
                                        );
                                    } else if (def.type === 'LIGHT_SAM_DEFENSE') {
                                        // SAM Intercept!
                                        def.fuel--;

                                        // Spawn SAM Missile
                                        const samStats = ENTITY_STATS.SAM_MISSILE;
                                        const vec = this.constructor.getToroidalVector(
                                            def.x,
                                            def.y,
                                            closestProj.currX,
                                            closestProj.currY,
                                            this.map.width,
                                            this.map.height
                                        );
                                        const initialAngle =
                                            Math.atan2(vec.dy, vec.dx) * (180 / Math.PI);

                                        const samMissile = {
                                            id: 'sam_' + Math.random().toString(36).substr(2, 9),
                                            type: 'SAM_MISSILE',
                                            itemType: 'SAM_MISSILE',
                                            owner: def.owner,
                                            active: true,
                                            currX: def.x,
                                            currY: def.y,
                                            targetX: closestProj.currX, // Initial target X/Y for direction
                                            targetY: closestProj.currY,
                                            velocity: samStats.speed,
                                            currentAngle: initialAngle,
                                            targetId: closestProj.id, // LOCKED ON
                                            searchMode: true,
                                            totalDistanceMoved: 0,
                                            maxDistance: 600 // High enough range for defense
                                        };

                                        tempProjectiles.push(samMissile);
                                        console.log(
                                            `[SAM Launch] ${def.id} fired SAM at ${closestProj.id}`
                                        );
                                    }
                                }
                            }

                            // --- Persistent Flak Damage Logic ---
                            if (def.type === 'FLAK_DEFENSE' && def.flakActive) {
                                const stats = ENTITY_STATS.FLAK_DEFENSE;
                                tempProjectiles.forEach((proj) => {
                                    if (!proj.active || proj.hitByFlakDefense.has(def.id)) return;

                                    const pStats =
                                        ENTITY_STATS[proj.type] || ENTITY_STATS[proj.itemType];
                                    if (pStats?.isInterceptable === false) return;

                                    const dist = this.getToroidalDistance(
                                        def.x,
                                        def.y,
                                        proj.currX,
                                        proj.currY
                                    );
                                    if (dist <= stats.range) {
                                        const vec = this.constructor.getToroidalVector(
                                            def.x,
                                            def.y,
                                            proj.currX,
                                            proj.currY,
                                            this.map.width,
                                            this.map.height
                                        );
                                        const angleToProj =
                                            Math.atan2(vec.dy, vec.dx) * (180 / Math.PI);

                                        let diff = angleToProj - (def.flakAngle || 0);
                                        while (diff > 180) diff -= 360;
                                        while (diff < -180) diff += 360;

                                        if (Math.abs(diff) <= stats.arc / 2) {
                                            // HIT!
                                            proj.hp -= stats.damage;
                                            proj.hitByFlakDefense.add(def.id);

                                            // Impact Sparks
                                            tempVisuals.push({
                                                type: 'SPARK',
                                                x: proj.currX,
                                                y: proj.currY,
                                                duration: 15
                                            });

                                            console.log(
                                                `[Flak Hit] Proj ${proj.id} hit by ${def.id}. HP: ${proj.hp}`
                                            );

                                            if (proj.hp <= 0) {
                                                proj.active = false;
                                                const pStats =
                                                    ENTITY_STATS[proj.type] ||
                                                    ENTITY_STATS[proj.itemType];
                                                if (pStats?.deathEffect === 'DETONATE') {
                                                    proj.hitThisTick = true;
                                                }
                                            }
                                        }
                                    }
                                });
                            }
                        });

                        tempProjectiles.forEach((proj) => {
                            if (!proj.active) return;

                            const prevX = proj.currX;
                            const prevY = proj.currY;

                            if (proj.type === 'HOMING_MISSILE' || proj.type === 'SAM_MISSILE') {
                                const stats = ENTITY_STATS[proj.type];

                                // 1. Lifecycle Check: Ignite seeker at 50% distance
                                if (
                                    !proj.searchMode &&
                                    proj.totalDistanceMoved >= proj.intendedDistance * 0.5
                                ) {
                                    proj.searchMode = true;
                                }

                                // 2. Seeker Logic: Single Lock policy
                                if (proj.searchMode && !proj.targetId) {
                                    let minDist = Infinity;
                                    let closestTarget = null;

                                    this.entities.forEach((ent) => {
                                        if (ent.owner === proj.owner) return;
                                        if (
                                            ent.type === 'WEAPON' ||
                                            ent.type === 'PROJECTILE' ||
                                            ent.type === 'RESOURCE'
                                        )
                                            return;

                                        const dist = this.getToroidalDistance(
                                            proj.currX,
                                            proj.currY,
                                            ent.x,
                                            ent.y
                                        );
                                        if (dist > stats.homingRange) return;

                                        const vec = this.constructor.getToroidalVector(
                                            proj.currX,
                                            proj.currY,
                                            ent.x,
                                            ent.y,
                                            this.map.width,
                                            this.map.height
                                        );
                                        const angleToTarget =
                                            Math.atan2(vec.dy, vec.dx) * (180 / Math.PI);
                                        let diff = angleToTarget - proj.currentAngle;
                                        while (diff > 180) diff -= 360;
                                        while (diff < -180) diff += 360;

                                        if (Math.abs(diff) <= stats.searchCone / 2) {
                                            if (dist < minDist) {
                                                minDist = dist;
                                                closestTarget = ent;
                                            }
                                        }
                                    });

                                    if (closestTarget) {
                                        proj.targetId = closestTarget.id;
                                        proj.lockFound = true;
                                    }
                                }

                                // 3. Tracking Logic
                                if (proj.targetId) {
                                    let target = this.entities.find((e) => e.id === proj.targetId);
                                    if (!target && ENTITY_STATS[proj.type]?.isInterceptor) {
                                        target = tempProjectiles.find(
                                            (p) => p.id === proj.targetId && p.active
                                        );
                                    }

                                    if (target && (target.hp > 0 || target.active)) {
                                        // Accelerate if target is still active
                                        if (proj.velocity < stats.maxSpeed) {
                                            proj.velocity = Math.min(
                                                stats.maxSpeed,
                                                proj.velocity + stats.acceleration
                                            );
                                        }

                                        const targetX =
                                            target.x !== undefined ? target.x : target.currX;
                                        const targetY =
                                            target.y !== undefined ? target.y : target.currY;

                                        // Save last known coordinates for persistence
                                        proj.targetX = targetX;
                                        proj.targetY = targetY;

                                        const vec = this.constructor.getToroidalVector(
                                            proj.currX,
                                            proj.currY,
                                            targetX,
                                            targetY,
                                            this.map.width,
                                            this.map.height
                                        );
                                        const angleToTarget =
                                            Math.atan2(vec.dy, vec.dx) * (180 / Math.PI);

                                        let diff = angleToTarget - proj.currentAngle;
                                        while (diff > 180) diff -= 360;
                                        while (diff < -180) diff += 360;

                                        // Stability Hysteresis: If the target crosses the halfway point of the toroidal map,
                                        // the "shortest path" angle can suddenly flip 180 degrees. We detect this
                                        // and ignore the snap to avoid seeker oscillation.
                                        if (Math.abs(diff) > 170) {
                                            diff = 0;
                                        }

                                        const turn =
                                            Math.sign(diff) *
                                            Math.min(Math.abs(diff), stats.turnRadius);
                                        proj.currentAngle += turn;
                                    } else {
                                        proj.lockFound = false; // Target lost, stop hunting but keep flying straight
                                    }
                                } else if (proj.searchMode) {
                                    // Passive acceleration during search phase
                                    if (proj.velocity < stats.maxSpeed) {
                                        proj.velocity = Math.min(
                                            stats.maxSpeed,
                                            proj.velocity + stats.acceleration
                                        );
                                    }
                                }

                                // 4. Step-based Movement
                                const moveDist = proj.velocity;
                                const rad = (proj.currentAngle || 0) * (Math.PI / 180);
                                proj.currX = this.wrapX(proj.currX + Math.cos(rad) * moveDist);
                                proj.currY = this.wrapY(proj.currY + Math.sin(rad) * moveDist);
                                proj.totalDistanceMoved += moveDist;

                                // 5. Impact & Fuel Checks
                                const fuelLimit =
                                    proj.intendedDistance * 0.5 + (stats.homingFuel || 400);
                                if (proj.totalDistanceMoved >= fuelLimit) {
                                    proj.active = false;
                                    proj.hitThisTick = true; // Trigger detonation logic
                                }

                                // Immediate proximity trigger ONLY if targeting something
                                if (proj.targetId) {
                                    let target = this.entities.find((e) => e.id === proj.targetId);
                                    if (!target && ENTITY_STATS[proj.type]?.isInterceptor) {
                                        target = tempProjectiles.find(
                                            (p) => p.id === proj.targetId && p.active
                                        );
                                    }

                                    if (target && (target.hp > 0 || target.active)) {
                                        const tx = target.x !== undefined ? target.x : target.currX;
                                        const ty = target.y !== undefined ? target.y : target.currY;
                                        const actualDist = this.getToroidalDistance(
                                            proj.currX,
                                            proj.currY,
                                            tx,
                                            ty
                                        );

                                        // Surface-to-Surface trigger: detonate when "touching" the building's edge
                                        const targetStats =
                                            ENTITY_STATS[target.type] ||
                                            ENTITY_STATS[target.itemType];
                                        const hitDist = (targetStats?.size || 10) + 2;

                                        if (actualDist <= hitDist) {
                                            proj.active = false;
                                            proj.hitThisTick = true;
                                        }
                                    } else if (proj.targetX !== undefined) {
                                        // Target lost: detonate at last known coordinates
                                        const actualDist = this.getToroidalDistance(
                                            proj.currX,
                                            proj.currY,
                                            proj.targetX,
                                            proj.targetY
                                        );
                                        if (actualDist <= 15) {
                                            proj.active = false;
                                            proj.hitThisTick = true;
                                        }
                                    }
                                }
                            } else {
                                // Standard Projectile Logic (Buildings etc.)

                                // --- Cluster Bomb Special Logic ---
                                const clusterStats = ENTITY_STATS.CLUSTER_BOMB;
                                if (
                                    proj.type === 'CLUSTER_BOMB' &&
                                    !proj.hasSplit &&
                                    t >= proj.arrivalTick * clusterStats.splitTickRatio
                                ) {
                                    proj.active = false;
                                    proj.hasSplit = true;

                                    const originalTargetX = proj.startX + proj.intendedDx;
                                    const originalTargetY = proj.startY + proj.intendedDy;

                                    // Calculate perpendicular unit vector
                                    const dist = Math.sqrt(
                                        proj.intendedDx * proj.intendedDx +
                                        proj.intendedDy * proj.intendedDy
                                    );
                                    const px = -proj.intendedDy / dist;
                                    const py = proj.intendedDx / dist;

                                    const count = clusterStats.subBombCount;
                                    const totalSpread = clusterStats.spreadDistance;
                                    const step = totalSpread / (count - 1 || 1);

                                    for (let i = 0; i < count; i++) {
                                        const offset = i * step - totalSpread / 2;
                                        const subTargetX = originalTargetX + offset * px;
                                        const subTargetY = originalTargetY + offset * py;

                                        const splitX =
                                            proj.startX + proj.intendedDx * (t / proj.arrivalTick);
                                        const splitY =
                                            proj.startY + proj.intendedDy * (t / proj.arrivalTick);

                                        // Math to ensure sub-bomb arrives at subTargetX/Y at proj.arrivalTick
                                        // using the standard progress = t / arrivalTick formula.
                                        const factor = proj.arrivalTick / (t - proj.arrivalTick);
                                        const subIntendedDx = (splitX - subTargetX) * factor;
                                        const subIntendedDy = (splitY - subTargetY) * factor;
                                        const subStartX = subTargetX - subIntendedDx;
                                        const subStartY = subTargetY - subIntendedDy;

                                        tempProjectiles.push({
                                            ...proj,
                                            id: `${proj.id}-sub-${i}`,
                                            startX: subStartX,
                                            startY: subStartY,
                                            intendedDx: subIntendedDx,
                                            intendedDy: subIntendedDy,
                                            active: true,
                                            hasSplit: true, // Prevent re-splitting
                                            hitByFlakDefense: new Set() // Fresh flak state for sub-bombs
                                        });
                                    }
                                    console.log(
                                        `[Cluster] ${proj.id} split into ${count} sub-bombs at tick ${t}`
                                    );
                                }

                                const progress = t / proj.arrivalTick;

                                if (t < proj.arrivalTick) {
                                    // Use explicit intended vector to avoid "Shortest Path" directional flips
                                    proj.currX = this.wrapX(
                                        proj.startX + proj.intendedDx * progress
                                    );
                                    proj.currY = this.wrapY(
                                        proj.startY + proj.intendedDy * progress
                                    );
                                } else if (t === proj.arrivalTick) {
                                    // Final arrival precisely at arrivalTick
                                    proj.currX = this.wrapX(proj.startX + proj.intendedDx);
                                    proj.currY = this.wrapY(proj.startY + proj.intendedDy);
                                    proj.active = false;
                                    proj.hitThisTick = true;

                                    if (proj.type === 'RECLAIMER') {
                                        this.handleReclaim(
                                            proj.currX,
                                            proj.currY,
                                            proj.owner,
                                            tempVisuals,
                                            impacts
                                        );
                                    }
                                    const stats = ENTITY_STATS[proj.type];
                                    // Bug 2: landAsStructure: false avoids duplicate entities for weapons like Napalm
                                    if (
                                        ((stats?.damageFull === undefined &&
                                            proj.type !== 'RECLAIMER') ||
                                            stats?.landAsStructure) &&
                                        stats?.landAsStructure !== false
                                    ) {
                                        const data = {
                                            type: proj.type,
                                            owner: proj.owner,
                                            x: proj.currX,
                                            y: proj.currY,
                                            sourceId: proj.sourceId,
                                            intendedDx: proj.intendedDx,
                                            intendedDy: proj.intendedDy,
                                            deployed: false,
                                            hp: GLOBAL_STATS.UNDEPLOYED_HP
                                        };
                                        const newEnt = this.addEntity(data);
                                        console.log(
                                            '--- LANDING ---',
                                            newEnt.type,
                                            newEnt.id,
                                            'at',
                                            newEnt.x,
                                            newEnt.y
                                        );
                                        if (
                                            data.sourceId &&
                                            data.intendedDx !== undefined &&
                                            data.intendedDy !== undefined
                                        ) {
                                            this.addLink(
                                                data.sourceId,
                                                newEnt.id,
                                                data.owner,
                                                data.intendedDx,
                                                data.intendedDy
                                            );
                                            console.log(
                                                '--- LINK CREATED ---',
                                                data.sourceId,
                                                '->',
                                                newEnt.id
                                            );
                                        }
                                        console.log(
                                            `[Lifecycle] ${proj.owner} ${proj.type} landed at (${Math.round(proj.currX)}, ${Math.round(proj.currY)})`
                                        );
                                    }

                                    // --- Napalm Special Logic (Always deploy fire on arrival) ---
                                    if (proj.type === 'NAPALM') {
                                        const nStats = ENTITY_STATS.NAPALM_FIRE;
                                        this.addEntity({
                                            type: 'NAPALM_FIRE',
                                            owner: proj.owner,
                                            x: proj.currX, // Impact point (base of stadium)
                                            y: proj.currY,
                                            startX: proj.currX, // Base
                                            startY: proj.currY,
                                            endX: proj.originalTargetX, // Tip (Original target)
                                            endY: proj.originalTargetY,
                                            roundsLeft: 2, // New internal round tracking
                                            deployed: true,
                                            isHazard: true,
                                            hp: nStats.hp
                                        });
                                        console.log(
                                            `[Napalm] ${proj.id} deployed fire from (${Math.round(proj.currX)}, ${Math.round(proj.currY)}) to original target.`
                                        );

                                        // Push specialized landing snapshot for visual feedback
                                        snapshots.push({
                                            type: 'LANDING',
                                            tick: t,
                                            round: round,
                                            playerId: proj.owner,
                                            itemType: proj.type,
                                            state: this.getState()
                                        });
                                    }

                                    if (proj.type === 'OVERLOAD' && proj.hitThisTick) {
                                        this.triggerOverload(
                                            proj.currX,
                                            proj.currY,
                                            stats,
                                            tempVisuals,
                                            impacts,
                                            overloadedThisRound
                                        );
                                        proj.hitThisTick = false;
                                    }

                                    if (
                                        stats?.damageFull !== undefined &&
                                        !stats?.landAsStructure &&
                                        proj.hitThisTick
                                    ) {
                                        const potentialTargets = [
                                            ...this.entities,
                                            ...tempProjectiles.filter((p) => p.active)
                                        ];

                                        this.triggerExplosion(
                                            proj.currX,
                                            proj.currY,
                                            stats,
                                            tempVisuals,
                                            impacts,
                                            potentialTargets
                                        );
                                        proj.hitThisTick = false;
                                    }
                                }
                            }

                            // --- SHIELD PASSIVE INTERCEPTION (The Crossing Rule) ---
                            this.entities.forEach((shield) => {
                                if (!proj.active && !proj.hitThisTick) return;
                                if (shield.type !== 'SHIELD' || shield.barrierHp <= 0) return;
                                // 1. Reclaimer Exception: Friendly management tools bypass shields
                                if (proj.type === 'RECLAIMER' || proj.itemType === 'RECLAIMER') return;

                                const sStats = ENTITY_STATS.SHIELD;
                                const prevDist = this.getToroidalDistance(
                                    shield.x,
                                    shield.y,
                                    prevX,
                                    prevY
                                );
                                const currDist = this.getToroidalDistance(
                                    shield.x,
                                    shield.y,
                                    proj.currX,
                                    proj.currY
                                );


                                if (prevDist > sStats.range && currDist <= sStats.range) {
                                    // BLOCK!
                                    proj.active = false;
                                    proj.hitThisTick = false; // Prevent landing or detonation

                                    const pStats =
                                        ENTITY_STATS[proj.type] || ENTITY_STATS[proj.itemType];
                                    const isStructure =
                                        proj.type === 'HUB' ||
                                        proj.type === 'NUKE' ||
                                        proj.type === 'EXTRACTOR';

                                    if (!isStructure) {
                                        const damage = pStats?.damageFull || 1;
                                        shield.barrierHp -= damage;
                                        if (shield.barrierHp < 0) shield.barrierHp = 0;

                                        console.log(
                                            `[Shield Hit] ${proj.id} blocked by ${shield.id}. Shield HP: ${shield.barrierHp}`
                                        );
                                    } else {
                                        console.log(
                                            `[Shield Structure Block] ${proj.id} destroyed by ${shield.id}. No damage to shield.`
                                        );
                                    }

                                    // Visual effect
                                    tempVisuals.push({
                                        type: 'SPARK',
                                        x: proj.currX,
                                        y: proj.currY,
                                        duration: 15
                                    });
                                }
                            });

                            // --- Post-Movement Hazard Collision ---
                            if (proj.active) {
                                const hazards = this.entities.filter(
                                    (e) => e.type === 'EXPLOSION_HAZARD' || e.type === 'NAPALM_FIRE'
                                );
                                hazards.forEach((h) => {
                                    const hStats = ENTITY_STATS[h.type];
                                    let isHit = false;

                                    if (h.type === 'NAPALM_FIRE') {
                                        const dist = GameState.getPointToSegmentDistance(
                                            proj.currX,
                                            proj.currY,
                                            h.startX,
                                            h.startY,
                                            h.endX,
                                            h.endY,
                                            this.map.width,
                                            this.map.height
                                        );
                                        // Projectile incineration uses its radius (size or default)
                                        if (
                                            dist <=
                                            hStats.width / 2 + (ENTITY_STATS[proj.type]?.size || 8)
                                        )
                                            isHit = true;
                                    } else {
                                        if (
                                            GameState.lineCircleIntersection(
                                                prevX,
                                                prevY,
                                                proj.currX,
                                                proj.currY,
                                                h.x,
                                                h.y,
                                                hStats.radius || 200,
                                                this.map.width,
                                                this.map.height
                                            )
                                        ) {
                                            isHit = true;
                                        }
                                    }

                                    if (isHit) {
                                        console.log(
                                            `[Hazard] Projectile ${proj.id} incinerated by ${h.type} at (${Math.round(h.x)}, ${Math.round(h.y)})`
                                        );
                                        proj.active = false;
                                        proj.hitThisTick = false; // Destroyed mid-air, no detonation
                                    }
                                });
                            }
                        });

                        // Second pass for Weapons to catch anything that landed this tick (AOE Damage)
                        // This block is now redundant for non-seeker projectiles as the logic is moved above.
                        // It remains for seekers that might detonate at arrivalTick.
                        tempProjectiles.forEach((proj) => {
                            const stats = ENTITY_STATS[proj.type];
                            if (
                                stats?.damageFull !== undefined &&
                                !stats?.landAsStructure &&
                                proj.hitThisTick &&
                                (t === proj.arrivalTick || stats.isSeeker)
                            ) {
                                const potentialTargets = [
                                    ...this.entities,
                                    ...tempProjectiles.filter((p) => p.active)
                                ];

                                this.triggerExplosion(
                                    proj.currX,
                                    proj.currY,
                                    stats,
                                    tempVisuals,
                                    impacts,
                                    potentialTargets
                                );
                                proj.hitThisTick = false;
                            }
                        });

                        // Decay visuals
                        if (tempVisuals.length > 0) {
                            for (let i = tempVisuals.length - 1; i >= 0; i--) {
                                tempVisuals[i].duration--;
                                if (tempVisuals[i].duration <= 0) {
                                    tempVisuals.splice(i, 1);
                                }
                            }
                        }

                        if (t % snapshotStep === 0 || t === subTicks) {
                            // OPTIMIZATION: Only push sub-tick snapshot if something is actually happening (visuals or active missiles)
                            if (tempProjectiles.some((p) => p.active) || tempVisuals.length > 0) {
                                const snapshotState = this.getState();
                                snapshotState.entities = [
                                    ...snapshotState.entities,
                                    ...tempProjectiles
                                        .filter((p) => p.active)
                                        .map((p) => ({
                                            id: `proj-${p.id}`,
                                            type: 'PROJECTILE',
                                            itemType: p.type, // Map internal type to itemType for snapshot
                                            owner: p.owner,
                                            x: p.currX,
                                            y: p.currY,
                                            currentAngle: p.currentAngle,
                                            searchMode: p.searchMode,
                                            lockFound: p.lockFound,
                                            targetId: p.targetId
                                        })),
                                    ...tempVisuals.map((v) => ({
                                        id: `viz-${Math.random()}`,
                                        type: v.type,
                                        x: v.x,
                                        y: v.y,
                                        radius: v.radius,
                                        targetX: v.targetX,
                                        targetY: v.targetY
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
                    } // End Simulation loop (t)
                }

                // --- Hazard Damage (Structures) ---
                this.entities
                    .filter((e) => e.type === 'EXPLOSION_HAZARD' || e.type === 'NAPALM_FIRE')
                    .forEach((h) => {
                        const hStats = ENTITY_STATS[h.type];
                        this.entities.forEach((ent) => {
                            if (
                                ent.isHazard ||
                                ent.type === 'EXPLOSION_HAZARD' ||
                                ent.type === 'NAPALM_FIRE'
                            )
                                return;

                            let inRange = false;
                            if (h.type === 'NAPALM_FIRE') {
                                const dist = GameState.getPointToSegmentDistance(
                                    ent.x,
                                    ent.y,
                                    h.startX,
                                    h.startY,
                                    h.endX,
                                    h.endY,
                                    this.map.width,
                                    this.map.height
                                );
                                // Napalm Refinement: Collision if 'touching' (dist <= fireRadius + entSize)
                                if (dist <= hStats.width / 2 + (ent.size || 20)) inRange = true;
                            } else {
                                const dist = this.getToroidalDistance(h.x, h.y, ent.x, ent.y);
                                if (dist <= (hStats.radius || 200)) inRange = true;
                            }

                            if (inRange) {
                                ent.hp -= hStats.damageTick;
                                console.log(
                                    `[Hazard] ${ent.id} (${ent.type}) damaged by ${h.type} in round ${round}. HP: ${ent.hp}`
                                );
                                if (ent.hp <= 0) impacts.add(ent.id);
                            }
                        });

                        // Napalm Refinement: Decrement roundsLeft at the end of every internal round
                        if (h.type === 'NAPALM_FIRE') {
                            if (h.roundsLeft !== undefined) h.roundsLeft--;
                        }
                    });

                // --- Link Collision Detection (Post-Simulation) ---
                const newEntitiesThisRound = this.entities.filter((e) => e.deployed === false);
                const destroyedThisCheck = new Set();

                newEntitiesThisRound.forEach((newEnt) => {
                    const source = this.entities.find((e) => e.id === newEnt.sourceId);
                    if (!source) return;

                    const newSegments = GameState.getLinkSegments(
                        { x: source.x, y: source.y },
                        { x: newEnt.x, y: newEnt.y },
                        this.map.width,
                        this.map.height
                    );

                    // 1. Check against ALL existing/already deployed links
                    this.links.forEach((existingLink) => {
                        // Skip if this link belongs to the new segment we are currently checking
                        if (existingLink.to === newEnt.id) return;

                        const s1 = this.entities.find((e) => e.id === existingLink.from);
                        const s2 = this.entities.find((e) => e.id === existingLink.to);
                        if (!s1 || !s2) return;

                        const existingSegments = GameState.getLinkSegments(
                            { x: s1.x, y: s1.y },
                            { x: s2.x, y: s2.y },
                            this.map.width,
                            this.map.height
                        );

                        newSegments.forEach((nSeg) => {
                            existingSegments.forEach((eSeg) => {
                                const intersect = GameState.doSegmentsIntersect(nSeg, eSeg);
                                if (intersect) {
                                    // Guard: Ignore if intersection is within source hub radius
                                    const distFromSource = this.getToroidalDistance(
                                        source.x,
                                        source.y,
                                        intersect.x,
                                        intersect.y
                                    );
                                    if (distFromSource > ENTITY_STATS.HUB.size + 5) {
                                        destroyedThisCheck.add(newEnt.id);
                                        tempVisuals.push({
                                            type: 'LINK_COLLISION',
                                            x: intersect.x,
                                            y: intersect.y,
                                            duration: 30
                                        });
                                        console.log(
                                            `[Collision] New ${newEnt.type} link crossed existing link!`
                                        );
                                    }
                                }
                            });
                        });
                    });

                    // 2. Check against OTHER newly formed links this round (Simultaneous Conflict)
                    newEntitiesThisRound.forEach((otherNewEnt) => {
                        if (newEnt.id === otherNewEnt.id) return;
                        const otherSource = this.entities.find(
                            (e) => e.id === otherNewEnt.sourceId
                        );
                        if (!otherSource) return;

                        const otherSegments = GameState.getLinkSegments(
                            { x: otherSource.x, y: otherSource.y },
                            { x: otherNewEnt.x, y: otherNewEnt.y },
                            this.map.width,
                            this.map.height
                        );

                        newSegments.forEach((nSeg) => {
                            otherSegments.forEach((oSeg) => {
                                const intersect = GameState.doSegmentsIntersect(nSeg, oSeg);
                                if (intersect) {
                                    const distFromSource = this.getToroidalDistance(
                                        source.x,
                                        source.y,
                                        intersect.x,
                                        intersect.y
                                    );
                                    if (distFromSource > ENTITY_STATS.HUB.size + 5) {
                                        destroyedThisCheck.add(newEnt.id);
                                        destroyedThisCheck.add(otherNewEnt.id);
                                        tempVisuals.push({
                                            type: 'LINK_COLLISION',
                                            x: intersect.x,
                                            y: intersect.y,
                                            duration: 30
                                        });
                                        console.log(
                                            '[Collision] Simultaneous links crossed! Both destroyed.'
                                        );
                                    }
                                }
                            });
                        });
                    });
                });

                destroyedThisCheck.forEach((id) => {
                    const ent = this.entities.find((e) => e.id === id);
                    if (ent) {
                        ent.hp = 0;
                        impacts.add(id);
                    }
                });

                // Check for map hazards first (sets hp to 0)
                this.checkMapHazards(tempVisuals);

                // Check for structure overlaps (Rule A & B)
                this.checkStructureCollisions(tempVisuals);

                // Clean up all destroyed entities this round
                this.entities.forEach((e) => {
                    if (e.hp <= 0) impacts.add(e.id);
                });

                if (impacts.size > 0) {
                    this.entities = this.entities.filter((e) => !impacts.has(e.id));
                    this.links = this.links.filter(
                        (l) => !impacts.has(l.from) && !impacts.has(l.to)
                    );
                }

                // Final Deployment Phase: Restore HP and enable surviving structures
                this.entities.forEach((e) => {
                    if (e.deployed === false && e.hp > 0) {
                        // Only deploy if not destroyed by collision
                        e.deployed = true;
                        e.hp = ENTITY_STATS[e.type]?.hp || GLOBAL_STATS.DEFAULT_HP; // Restore full HP
                        console.log(`[Round ${round}]${e.type} ${e.id} fully deployed.`);
                    }
                });

                // Clean up flak state for this round
                this.entities.forEach((e) => {
                    if (e.type === 'FLAK_DEFENSE') {
                        e.flakActive = false;
                        e.flakAngle = null;
                        e.flakTriggerTick = null;
                    }
                });

                // Update activeInProgress for next round
                const hasActionsLeft = Object.keys(this.players).some((pid) => {
                    const actions = playerActionsMap[pid] || [];
                    for (let i = 0; i < actions.length; i++) {
                        if (!processedActions[pid].has(i)) return true;
                    }
                    return false;
                });
                const hasPendingEchos = this.entities.some(
                    (e) =>
                        e.type === 'ECHO_ARTILLERY' && e.pendingEchos && e.pendingEchos.length > 0
                );
                const hasProjectiles = tempProjectiles && tempProjectiles.some((p) => p.active);
                activeInProgress = hasActionsLeft || hasProjectiles || hasPendingEchos;

                // Link Decay check after every round
                this.checkLinkIntegrity(round);

                snapshots.push({
                    type: 'ROUND',
                    round: round,
                    state: this.getState()
                });
            } else {
                activeInProgress = false;
            }

            // Napalm Refinement: Remove any hazards that have run out of roundsLeft
            this.entities = this.entities.filter(
                (e) => e.type !== 'NAPALM_FIRE' || e.roundsLeft > 0
            );

            // Safety break for infinite loops
            if (round > 20) break;
        }

        // 3. Final HP Cleanup & Status Update
        this.entities = this.entities.filter((e) => e.hp > 0);
        this.links = this.links.filter((l) => {
            const fromEnt = this.entities.find((e) => e.id === l.from);
            const toEnt = this.entities.find((e) => e.id === l.to);
            return fromEnt && toEnt;
        });

        Object.keys(this.players).forEach((pid) => {
            const hasHub = this.entities.some((e) => e.owner === pid && e.type === 'HUB');
            if (!hasHub) {
                this.players[pid].alive = false;
            }
        });

        const alivePlayers = Object.keys(this.players).filter((pid) => this.players[pid].alive);
        if (alivePlayers.length === 1) {
            this.winner = alivePlayers[0];
        } else if (alivePlayers.length === 0) {
            this.winner = 'DRAW';
        }

        // Napalm Refinement: Purge ALL internal-round-based hazards at end of resolveTurn
        // they should never persist across Planning phases.
        this.entities = this.entities.filter((e) => e.type !== 'NAPALM_FIRE');

        this.turn += 1;

        // Replenish Fuel for the next turn's planning phase
        this.entities.forEach((e) => {
            if (e.fuel !== undefined) {
                const regen = ENTITY_STATS[e.type]?.fuelRegen || 0;
                e.fuel = Math.min(e.maxFuel, e.fuel + regen);
            }
        });

        snapshots.push({ type: 'FINAL', state: this.getState() });

        return snapshots;
    }

    triggerOverload(
        x,
        y,
        stats,
        tempVisuals = [],
        impacts = new Set(),
        overloadedThisRound = new Set()
    ) {
        const affectedStructureIds = new Set();
        const detectionRadius = stats.detectionRadius || 30;

        // 1. Direct Structure Hits
        this.entities.forEach((ent) => {
            if (ent.isHazard) return;
            const dist = this.getToroidalDistance(x, y, ent.x, ent.y);
            const size = ENTITY_STATS[ent.type]?.size || 20;
            if (dist <= size + 5) {
                // Slight buffer for direct hits
                affectedStructureIds.add(ent.id);
                // Downstream hop: children of the hit structure
                this.links.forEach((link) => {
                    if (link.from === ent.id) {
                        affectedStructureIds.add(link.to);
                    }
                });
            }
        });

        // 2. Link Hits (Downstream structure only)
        this.links.forEach((link) => {
            const s1 = this.entities.find((e) => e.id === link.from);
            const s2 = this.entities.find((e) => e.id === link.to);
            if (!s1 || !s2) return;

            const dist = GameState.getPointToSegmentDistance(
                x,
                y,
                s1.x,
                s1.y,
                s2.x,
                s2.y,
                this.map.width,
                this.map.height
            );
            if (dist <= detectionRadius) {
                affectedStructureIds.add(link.to); // Downstream only
            }
        });

        // 3. Apply Damage (Limit: 1 HP per round)
        affectedStructureIds.forEach((id) => {
            if (overloadedThisRound.has(id)) return; // Already hit this round

            const target = this.entities.find((e) => e.id === id);
            if (target && target.hp > 0) {
                target.hp -= 1;
                overloadedThisRound.add(id);
                if (target.hp <= 0) impacts.add(id);
                console.log(`[Overload] ${id} took 1 chain damage. HP: ${target.hp}`);
            }
        });

        // 4. Visuals (Uses the same EXPLOSION effect but typed as OVERLOAD for color)
        tempVisuals.push({
            type: 'EXPLOSION',
            itemType: 'OVERLOAD',
            x,
            y,
            duration: 40,
            radius: detectionRadius
        });
    }

    getState() {
        return {
            turn: this.turn,
            phase: this.phase,
            players: JSON.parse(JSON.stringify(this.players)),
            entities: this.entities.map((e) => ({ ...e })),
            links: this.links.map((l) => ({ ...l })),
            map: this.map,
            winner: this.winner
        };
    }
    /**
     * Decomposes a toroidal link into 1, 2, or 4 Euclidean segments.
     */
    static getLinkSegments(p1, p2, width, height) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;

        // Effective vector taking shortest toroidal path
        let edx = dx;
        if (Math.abs(dx) > width / 2) {
            edx = dx > 0 ? dx - width : dx + width;
        }

        let edy = dy;
        if (Math.abs(dy) > height / 2) {
            edy = dy > 0 ? dy - height : dy + height;
        }

        const segments = [];
        const wrapX = Math.abs(dx) > width / 2;
        const wrapY = Math.abs(dy) > height / 2;

        if (!wrapX && !wrapY) {
            segments.push({ p1: { ...p1 }, p2: { ...p2 } });
        } else {
            // Complex case: Break into segments at boundaries
            // We use the effective vector to trace the path and split at 0/width or 0/height

            // For simplicity in a prototype:
            // High-res sampling is robust but slow.
            // Euclidean splitting:
            if (wrapX && !wrapY) {
                const xEdge = edx > 0 ? width : 0;
                const distToEdge = Math.abs(xEdge - p1.x);
                const t = distToEdge / Math.abs(edx);
                const yEdge = p1.y + edy * t;

                segments.push({ p1: { ...p1 }, p2: { x: xEdge, y: yEdge } });
                segments.push({ p1: { x: width - xEdge, y: yEdge }, p2: { ...p2 } });
            } else if (!wrapX && wrapY) {
                const yEdge = edy > 0 ? height : 0;
                const distToEdge = Math.abs(yEdge - p1.y);
                const t = distToEdge / Math.abs(edy);
                const xEdge = p1.x + edx * t;

                segments.push({ p1: { ...p1 }, p2: { x: xEdge, y: yEdge } });
                segments.push({ p1: { x: xEdge, y: height - yEdge }, p2: { ...p2 } });
            } else {
                // Double wrap (rare corner case)
                // Just use the two main endpoints for now to avoid overcomplicating
                // but let's at least handle the primary segments
                segments.push({ p1: { ...p1 }, p2: { ...p1 } }); // Placeholder for quad split
            }
        }
        return segments;
    }

    /**
     * Point-to-Segment Distance Math (Toroidal Aware)
     * Returns the shortest physical distance from point (px, py) to line segment (x1, y1)-(x2, y2)
     */
    static getPointToSegmentDistance(px, py, x1, y1, x2, y2, width = 2000, height = 2000) {
        // Translate problem to be relative to (x1, y1) in a toroidal way
        let dx = x2 - x1;
        let dy = y2 - y1;
        if (Math.abs(dx) > width / 2) dx = dx > 0 ? dx - width : dx + width;
        if (Math.abs(dy) > height / 2) dy = dy > 0 ? dy - height : dy + height;

        let ppx = px - x1;
        let ppy = py - y1;
        if (Math.abs(ppx) > width / 2) ppx = ppx > 0 ? ppx - width : ppx + width;
        if (Math.abs(ppy) > height / 2) ppy = ppy > 0 ? ppy - height : ppy + height;

        const proj = GameState.getPointOnSegment(ppx, ppy, 0, 0, dx, dy);
        return Math.sqrt(Math.pow(ppx - proj.x, 2) + Math.pow(ppy - proj.y, 2));
    }

    /**
     * Point-to-Segment Math Helper
     * Returns the closest point on segment (x1, y1)-(x2, y2) to (px, py)
     */
    static getPointOnSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        if (dx === 0 && dy === 0) return { x: x1, y: y1 };

        const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
        if (t < 0) return { x: x1, y: y1 };
        if (t > 1) return { x: x2, y: y2 };

        return {
            x: x1 + t * dx,
            y: y1 + t * dy
        };
    }

    /**
     * Trigger an AOE explosion at (x, y) with given stats.
     * @param {number} x
     * @param {number} y
     * @param {object} stats - EntityStats for the exploding item
     * @param {array} tempVisuals - Array to push visual effects to
     * @param {Set} impacts - Set to add destroyed entity IDs to
     * @param {array} potentialTargets - Array of entities/projectiles to check for damage
     */
    /**
     * Reclaims all friendly structures in a radius, refunding 50% cost.
     */
    handleReclaim(x, y, owner, tempVisuals = [], impacts = new Set()) {
        const stats = ENTITY_STATS.RECLAIMER;
        const radius = stats.radiusFull;

        console.log(
            `[Reclaim] Triggered by ${owner} at (${Math.round(x)}, ${Math.round(y)}) with radius ${radius}`
        );

        // Visual Effect
        tempVisuals.push({
            type: 'RECLAIM', // Client will handle this unique visual
            x: x,
            y: y,
            duration: GLOBAL_STATS.EXPLOSION_DURATION,
            radius: radius
        });

        this.entities.forEach((entity) => {
            if (entity.owner !== owner || entity.isHazard || entity.type === 'EXPLOSION_HAZARD')
                return;

            const tStats = ENTITY_STATS[entity.type] || ENTITY_STATS[entity.itemType];
            const dist = this.getToroidalDistance(entity.x, entity.y, x, y);
            const effDist = Math.max(0, dist - (tStats?.size || 0));

            if (effDist <= radius) {
                const refund = Math.ceil((tStats?.cost || 0) * 0.5);
                this.players[owner].energy += refund;
                impacts.add(entity.id);

                tempVisuals.push({
                    type: 'SPARK',
                    x: entity.x,
                    y: entity.y,
                    duration: 20
                });

                console.log(
                    `[Reclaim] MATCH: Reclaimed ${entity.id} (${entity.type}). Refund: ${refund}. Total Energy: ${this.players[owner].energy}`
                );
            }
        });
    }

    triggerExplosion(x, y, stats, tempVisuals = [], impacts = new Set(), potentialTargets = []) {
        console.log(
            `[Explosion] Triggered at (${Math.round(x)}, ${Math.round(y)}) with radius ${stats.radiusFull}`
        );

        // 1. Visual Effect
        tempVisuals.push({
            type: 'EXPLOSION',
            x: x,
            y: y,
            duration: GLOBAL_STATS.EXPLOSION_DURATION,
            radius: stats.radiusFull
        });

        // 2. Damage Application
        const FULL_RADIUS = stats.radiusFull;
        const HALF_RADIUS = stats.radiusHalf;

        potentialTargets.forEach((target) => {
            // Hazards and the map features themselves are immune to damage
            if (target.isHazard || target.type === 'EXPLOSION_HAZARD') return;
            const tStats = ENTITY_STATS[target.type] || ENTITY_STATS[target.itemType];
            const tx = target.x !== undefined ? target.x : target.currX;
            const ty = target.y !== undefined ? target.y : target.currY;

            const rawDist = this.getToroidalDistance(tx, ty, x, y);
            const effDist = Math.max(0, rawDist - (tStats?.size || 0));

            let damage = 0;
            if (effDist <= FULL_RADIUS) {
                damage = stats.damageFull;
            } else if (effDist <= HALF_RADIUS) {
                damage = stats.damageHalf;
            }

            if (damage > 0) {
                target.hp -= damage;
                const status = target.deployed === false ? 'UNDEPLOYED' : 'DEPLOYED';
                const targetName = target.id
                    ? `${target.id} (${target.type})`
                    : `Projectile ${target.type}`;
                console.log(
                    `[AOE Damage] ${targetName} [${status}] took ${damage} damage. Current HP: ${target.hp}`
                );

                if (target.hp <= 0) {
                    if (target.id && this.entities.some((e) => e.id === target.id)) {
                        impacts.add(target.id);
                    } else {
                        // Handle projectile destruction in flight
                        target.active = false;
                        if (tStats?.deathEffect === 'DETONATE') {
                            // Note: We don't chain explosions here to prevent recursion loops,
                            // but we mark it so it can detonate in ITS turn if appropriate.
                            target.hitThisTick = true;
                        }
                    }
                    console.log(`[Combat] ${targetName} was DESTROYED by explosion!`);
                }
            }
        });
    }
    /**
     * Standard Line Segment Intersection (Cramer's Rule)
     * Returns {x, y} or null
     */
    static doSegmentsIntersect(s1, s2) {
        const x1 = s1.p1.x,
            y1 = s1.p1.y;
        const x2 = s1.p2.x,
            y2 = s1.p2.y;
        const x3 = s2.p1.x,
            y3 = s2.p1.y;
        const x4 = s2.p2.x,
            y4 = s2.p2.y;

        const den = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
        if (den === 0) return null; // Parallel

        const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / den;
        const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / den;

        if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
            return {
                x: x1 + ua * (x2 - x1),
                y: y1 + ua * (y2 - y1)
            };
        }
        return null;
    }

    /**
     * Internal Echo Artillery logic: Detect a launch and schedule a response.
     * Used by both manual and automated launches.
     */
    triggerEchoArtillery(sourceX, sourceY, launcherId, round) {
        this.entities.forEach((ent) => {
            if (ent.type === 'ECHO_ARTILLERY' && ent.owner !== launcherId && !ent.firedThisTurn) {
                const dist = this.getToroidalDistance(sourceX, sourceY, ent.x, ent.y);
                if (dist <= (ENTITY_STATS.ECHO_ARTILLERY.detectionRange || 800)) {
                    ent.pendingEchos.push({ x: sourceX, y: sourceY, triggerRound: round });
                    ent.firedThisTurn = true;
                    console.log(
                        `[Echo-Detection] Artillery ${ent.id} detected launch by ${launcherId} from (${Math.round(sourceX)}, ${Math.round(sourceY)})`
                    );
                }
            }
        });
    }
}
