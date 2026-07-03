/**
 * GameState.js
 *
 * This class represents the "Single Source of Truth" for your game world.
 * It is designed to be "headless", meaning it doesn't care about rendering
 * or UI. This makes it easy to move to the server later!
 */

import {
    ENTITY_STATS,
    GLOBAL_STATS,
    RESOURCE_NODE_STATS,
    ENTITY_TYPES
} from './constants/EntityStats.js';
import * as TorusMath from './utils/TorusMath.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { ProjectileSystem } from './systems/ProjectileSystem.js';
import { VisibilitySystem } from './systems/VisibilitySystem.js';

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
        this.windState = {
            active: false,
            angle: 0,
            speed: 0,
            duration: 0,
            cooldown: 12
        };
    }

    /**
     * Non-linear power curve math
     * Given a raw pull distance, returns the tactical launch distance.
     */
    static calculateLaunchDistance(pullDistance) {
        return TorusMath.calculateLaunchDistance(pullDistance);
    }

    /**
     * Calculate launch angle in degrees given a dx, dy pull vector.
     * Note: The launch direction is OPPOSITE to the pull direction.
     */
    static calculateLaunchAngle(dx, dy) {
        return TorusMath.calculateLaunchAngle(dx, dy);
    }

    /**
     * Helper to get the shortest distance vector (dx, dy) between two points on a torus.
     */
    static getToroidalVector(x1, y1, x2, y2, w, h) {
        return TorusMath.getToroidalVector(x1, y1, x2, y2, w, h);
    }

    /**
     * Checks if a line segment (x1, y1) -> (x2, y2) intersects a circle (cx, cy, radius).
     * Accounts for toroidal wrapping by normalizing relative to the circle center.
     */
    static lineCircleIntersection(x1, y1, x2, y2, cx, cy, radius, w, h) {
        return TorusMath.lineCircleIntersection(x1, y1, x2, y2, cx, cy, radius, w, h);
    }

    /**
     * Map wrapping logic for Toroidal world
     */
    wrapX(x) {
        return TorusMath.wrapX(x, this.map.width);
    }

    wrapY(y) {
        return TorusMath.wrapY(y, this.map.height);
    }

    /**
     * Shortest distance between two points on a torus
     */
    getToroidalDistance(x1, y1, x2, y2) {
        return TorusMath.getToroidalDistance(x1, y1, x2, y2, this.map.width, this.map.height);
    }

    updateWindCycle() {
        if (!this.map?.modifiers?.windEnabled) {
            this.windState.active = false;
            this.windState.speed = 0;
            this.windState.dx = 0;
            this.windState.dy = 0;
            return;
        }

        if (this.windState.active) {
            this.windState.duration--;
            if (this.windState.duration <= 0) {
                this.windState.active = false;
                this.windState.speed = 0;
                this.windState.angle = 0;
                this.windState.cooldown = Math.floor(Math.random() * 6) + 10; // 10 to 15 turns
            }
        } else {
            this.windState.cooldown--;
            if (this.windState.cooldown <= 0) {
                this.windState.active = true;
                this.windState.duration = Math.floor(Math.random() * 4) + 3; // 3 to 6 turns
                this.windState.angle = Math.random() * 360;
                this.windState.speed = Math.random() * 1.0 + 0.5; // 0.5 to 1.5 pixels per sub-tick
            }
        }

        const rad = (this.windState.angle * Math.PI) / 180;
        this.windState.dx = this.windState.active ? Math.cos(rad) * this.windState.speed : 0;
        this.windState.dy = this.windState.active ? Math.sin(rad) * this.windState.speed : 0;
    }

    /**
     * Checks if a specific coordinate is visible to a player.
     * Accounts for toroidal wrapping.
     */
    isPositionVisible(playerId, x, y, entities = null) {
        return VisibilitySystem.isPositionVisible(this, playerId, x, y, entities);
    }

    /**
     * Helper to check if a position is protected by a Cloaking Field.
     */
    isPositionCloaked(ownerId, x, y, entities = null) {
        return VisibilitySystem.isPositionCloaked(this, ownerId, x, y, entities);
    }

    /**
     * Returns a list of vision circles { x, y, radius } for a given player.
     */
    getVisionCircles(playerId) {
        return VisibilitySystem.getVisionCircles(this, playerId);
    }

    /**
     * Updates the 'scouted' status of all entities based on current vision.
     */
    updateScouting(extraEntities = []) {
        VisibilitySystem.updateScouting(this, extraEntities);
    }

    /**
     * Returns a filtered version of the state based on what a player can see.
     */
    getVisibleState(playerId, baseState = null) {
        return VisibilitySystem.getVisibleState(this, playerId, baseState);
    }

    /**
     * Initialize a new game for a set of players
     */
    initializeGame(playerIds, mapConfig = null, playerTeams = null) {
        this.turn = 1;
        this.entities = [];
        this.links = [];
        this.players = {};
        this.winner = null;

        if (mapConfig) {
            // Use injected map configuration
            this.map.width = mapConfig.width || GLOBAL_STATS.MAP_WIDTH;
            this.map.height = mapConfig.height || GLOBAL_STATS.MAP_HEIGHT;
            this.map.resources = [...(mapConfig.resources || [])];
            this.map.lakes = [...(mapConfig.lakes || [])];
            this.map.mountains = [...(mapConfig.mountains || [])];
            this.map.modifiers = { ...(mapConfig.modifiers || {}) };

            const teamABases = mapConfig.playerBases?.filter(b => b.team === 'Team A') || [];
            const teamBBases = mapConfig.playerBases?.filter(b => b.team === 'Team B') || [];
            const neutralBases = mapConfig.playerBases?.filter(b => !b.team) || [];

            let teamAIndex = 0;
            let teamBIndex = 0;
            let neutralIndex = 0;

            playerIds.forEach((id, index) => {
                const team = playerTeams ? playerTeams[id] : null;
                this.players[id] = {
                    energy: GLOBAL_STATS.STARTING_ENERGY,
                    color: `hsl(${index * 60}, 85%, 60%)`,
                    alive: true,
                    team: team || null
                };

                // Find base by owner or by index/team
                let base;
                if (team === 'Team A' && teamAIndex < teamABases.length) {
                    base = teamABases[teamAIndex++];
                } else if (team === 'Team B' && teamBIndex < teamBBases.length) {
                    base = teamBBases[teamBIndex++];
                } else {
                    const pKey = `player${index + 1}`;
                    base =
                        mapConfig.playerBases?.find((b) => b.owner === pKey) ||
                        neutralBases[neutralIndex++] ||
                        mapConfig.playerBases?.[index];
                }

                if (base) {
                    this.addEntity({
                        type: 'HUB',
                        owner: id,
                        x: base.x,
                        y: base.y,
                        hp: ENTITY_STATS.HUB.hp,
                        isStarter: true
                    });
                }
            });
        } else {
            // Default Hardcoded Layout
            const defaultBases = {
                'Team A': [
                    { x: 200, y: 500 },
                    { x: 200, y: 1000 },
                    { x: 200, y: 1500 },
                    { x: 500, y: 1000 }
                ],
                'Team B': [
                    { x: 1800, y: 500 },
                    { x: 1800, y: 1000 },
                    { x: 1800, y: 1500 },
                    { x: 1500, y: 1000 }
                ]
            };

            let teamAIndex = 0;
            let teamBIndex = 0;

            playerIds.forEach((id, index) => {
                const team = playerTeams ? playerTeams[id] : null;
                this.players[id] = {
                    energy: GLOBAL_STATS.STARTING_ENERGY,
                    color: `hsl(${index * 60}, 85%, 60%)`,
                    alive: true,
                    team: team || null
                };

                let startX, startY;
                if (team === 'Team A' && teamAIndex < defaultBases['Team A'].length) {
                    const coords = defaultBases['Team A'][teamAIndex++];
                    startX = coords.x;
                    startY = coords.y;
                } else if (team === 'Team B' && teamBIndex < defaultBases['Team B'].length) {
                    const coords = defaultBases['Team B'][teamBIndex++];
                    startX = coords.x;
                    startY = coords.y;
                } else {
                    startX = 250 + index * 500;
                    startY = 500;
                }

                this.addEntity({
                    type: 'HUB',
                    owner: id,
                    x: startX,
                    y: startY,
                    hp: ENTITY_STATS.HUB.hp,
                    isStarter: true
                });
            });

            const { STANDARD, SUPER } = RESOURCE_NODE_STATS;
            this.map.resources = [
                { id: 'res1', x: 500, y: 250, ...STANDARD },
                { id: 'res2', x: 1500, y: 750, ...STANDARD },
                { id: 'res3', x: 1000, y: 500, ...SUPER },
                { id: 'res4', x: 1000, y: 1500, ...STANDARD }
            ];
            this.map.lakes = [{ id: 'lake1', x: 1000, y: 560, radius: 100 }];
            this.map.mountains = [
                { id: 'mtn1', x: 1200, y: 1500, radius: 100 },
                { id: 'mtn2', x: 1350, y: 1500, radius: 100 },
                { id: 'mtn3', x: 1500, y: 1500, radius: 100 }
            ];
            this.map.modifiers = { windEnabled: true };
        }
    }

    /**
     * Link Decay: Any structure not connected (via links) to
     * its player's starter hub is destroyed.
     */
    checkLinkIntegrity() {
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
                    e.type !== 'EXPLOSION_HAZARD' &&
                    !ENTITY_STATS[e.type]?.isSeeker;
                if (isOrphan) {
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
            disabledUntilTurn: 0,
            scouted: data.scouted || false,
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

        // Initialize capture status for Extractors
        if (data.type === 'EXTRACTOR') {
            this.updateExtractorStatus(entity);
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

    updateSeekerProjectile(proj, stats, tempProjectiles) {
        ProjectileSystem.updateSeekerProjectile(this, proj, stats, tempProjectiles);
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

            // --- Status Lockout ---
            if (ent.disabledUntilTurn > this.turn) {
                if (ent.type === 'NUKE' && ent.detonationTurn !== undefined) {
                    ent.detonationTurn += 1;
                }
                return;
            }
        });

        // 1. Generate Energy for all active players
        Object.keys(this.players).forEach((pid) => {
            if (!this.players[pid].alive) return;

            let turnIncome = GLOBAL_STATS.ENERGY_INCOME_PER_TURN; // Base UBI

            // Add income from entities (Hubs and Extractors)
            this.entities.forEach((entity) => {
                if (entity.owner === pid) {
                    // Skip energy generation for disabled entities
                    if (entity.disabledUntilTurn > this.turn) return;

                    const stats = ENTITY_STATS[entity.type];
                    if (stats && stats.energyGen) {
                        let entityIncome = stats.energyGen;

                        // Extractor-specific node bonus
                        if (entity.type === 'EXTRACTOR') {
                            this.updateExtractorStatus(entity);
                            if (entity.isCapturing && entity.capturedNodeId) {
                                const node = this.map.resources.find(
                                    (r) => r.id === entity.capturedNodeId
                                );
                                if (node) {
                                    entityIncome += node.value || 0;
                                    console.log(
                                        `[Economy] Extractor ${entity.id} on node ${node.id} generated ${entityIncome} total.`
                                    );
                                }
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

        // Reset per-round tracking state on all entities
        this.entities.forEach((e) => {
            e.lastRoundFired = -1;
            if (e.type === 'FLAK_DEFENSE') {
                e.flakActive = false;
                e.flakTriggerTick = 0;
            }
        });

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
                    echo.disabledUntilTurn > this.turn // Skip if disabled by EMP
                ) {
                    echo.pendingEchos = []; // Clear pending echos if disabled
                    return;
                }

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
                            hitByFlakDefense: new Set(),
                            scheduledEffects: [] // List of { type: 'incinerate'|'damage', amount, tick, sourceId }
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

                    // Discard invalid actions (source destroyed, out of fuel, or disabled by EMP)
                    if (
                        !source ||
                        (source.fuel !== undefined && source.fuel <= 0) ||
                        source.disabledUntilTurn > this.turn
                    ) {
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
                            `[Launch-Trace] Added ${action.itemType} to tempProjectiles. Count: ${tempProjectiles.length}`
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
                            hasSplit: false,
                            scheduledEffects: []
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
                    // OPTIMIZATION: Pre-filter active defensive structures once per round
                    const activeDefenses = this.entities.filter((def) => {
                        const stats = ENTITY_STATS[def.type];
                        return stats && stats.range && def.deployed !== false && def.disabledUntilTurn <= this.turn;
                    });

                    for (let t = 1; t <= subTicks; t++) {
                        // --- Interception Logic ---
                        // Reset per-round flak tracking for active projectiles
                        tempProjectiles.forEach((proj) => {
                            if (proj.hitByFlakDefense) proj.hitByFlakDefense.clear();

                            // --- Process Scheduled Effects ---
                            if (
                                proj.active &&
                                proj.scheduledEffects &&
                                proj.scheduledEffects.length > 0
                            ) {
                                for (let i = proj.scheduledEffects.length - 1; i >= 0; i--) {
                                    const effect = proj.scheduledEffects[i];
                                    if (t >= effect.tick) {
                                        if (effect.type === 'incinerate') {
                                            proj.active = false;
                                            proj.hitThisTick = false; // Incinerated mid-air
                                            console.log(
                                                `[Scheduled] Projectile ${proj.id} incinerated by ${effect.sourceId} at tick ${t}`
                                            );
                                        } else if (effect.type === 'damage') {
                                            proj.hp -= effect.amount;
                                            console.log(
                                                `[Scheduled] Projectile ${proj.id} took ${effect.amount} damage from ${effect.sourceId} at tick ${t}. HP: ${proj.hp}`
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
                                        proj.scheduledEffects.splice(i, 1);
                                    }
                                }
                            }
                        });

                        activeDefenses.forEach((def) => {
                            if (def.hp <= 0) return;

                            const stats = ENTITY_STATS[def.type];

                            // SKIP if disabled/out of fuel
                            if (
                                typeof def.fuel === 'number' &&
                                def.fuel <= 0 &&
                                !(def.type === 'FLAK_DEFENSE' && def.flakActive)
                            )
                                return;

                            // Rule: One defensive action per turn round per structure (EXCEPT persistent ones)
                            if (
                                def.lastRoundFired === round &&
                                def.type !== 'FLAK_DEFENSE' &&
                                def.type !== 'SHIELD'
                            )
                                return;

                            // Flak logic: If already active, it doesn't need to re-trigger or search
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
                                            // Check if already scheduled a hit from this source
                                            if (
                                                !proj.scheduledEffects.some(
                                                    (e) => e.sourceId === def.id
                                                )
                                            ) {
                                                const delay = 5 + Math.floor(Math.random() * 5);
                                                proj.scheduledEffects.push({
                                                    type: 'damage',
                                                    amount: stats.damage,
                                                    tick: t + delay,
                                                    sourceId: def.id
                                                });
                                                tempVisuals.push({
                                                    type: 'SPARK',
                                                    x: proj.currX,
                                                    y: proj.currY,
                                                    duration: 15
                                                });
                                            }
                                        }
                                    }
                                });
                                return;
                            }
                            let closestProj = null;
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
                                    (dist === minDist && (!closestProj || proj.id < closestProj.id))
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
                                    def.flakAngle = Math.atan2(vec.dy, vec.dx) * (180 / Math.PI);
                                } else if (
                                    def.type === 'LIGHT_SAM_DEFENSE' ||
                                    def.type === 'SMART_SAM_DEFENSE'
                                ) {
                                    // SAM Intercept!
                                    def.fuel--;

                                    const projectileType =
                                        def.type === 'SMART_SAM_DEFENSE'
                                            ? 'SMART_SAM_MISSILE'
                                            : 'SAM_MISSILE';
                                    const samStats = ENTITY_STATS[projectileType];
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
                                        type: projectileType,
                                        itemType: projectileType,
                                        owner: def.owner,
                                        active: true,
                                        currX: def.x,
                                        currY: def.y,
                                        targetX: closestProj.currX,
                                        targetY: closestProj.currY,
                                        velocity: samStats.speed,
                                        currentAngle: initialAngle,
                                        targetId: closestProj.id,
                                        searchMode: false, // Start locked
                                        totalDistanceMoved: 0,
                                        intendedDistance: 1000, // Fuel limit
                                        hitByFlakDefense: new Set(),
                                        scheduledEffects: []
                                    };

                                    tempProjectiles.push(samMissile);
                                }
                            }
                        });

                        tempProjectiles.forEach((proj) => {
                            if (!proj.active) return;

                            const prevX = proj.currX;
                            const prevY = proj.currY;

                            if (
                                proj.type === 'HOMING_MISSILE' ||
                                proj.type === 'SAM_MISSILE' ||
                                proj.type === 'SMART_SAM_MISSILE'
                            ) {
                                const stats = ENTITY_STATS[proj.type];
                                this.updateSeekerProjectile(proj, stats, tempProjectiles);
                            } else {
                                ProjectileSystem.updateStandardProjectile(
                                    this,
                                    proj,
                                    t,
                                    round,
                                    tempProjectiles,
                                    tempVisuals,
                                    impacts,
                                    overloadedThisRound,
                                    snapshots
                                );
                            }

                            CollisionSystem.checkShieldInterception(
                                this,
                                proj,
                                prevX,
                                prevY,
                                tempVisuals,
                                impacts
                            );
                            CollisionSystem.checkHazardCollision(this, proj, prevX, prevY, t);
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

                        // Update scouting for all entities (permanent persistence)
                        this.updateScouting(tempProjectiles);

                        // Force snapshot on structural landing tick to ensure secure Fog of War audio propagates instantly
                        let forceSnapshot = false;
                        tempProjectiles.forEach((p) => {
                            if (
                                t === p.arrivalTick &&
                                ENTITY_STATS[p.type]?.type === ENTITY_TYPES.STRUCTURE
                            ) {
                                forceSnapshot = true;
                            }
                        });

                        if (t % snapshotStep === 0 || t === subTicks || forceSnapshot) {
                            // OPTIMIZATION: Only push sub-tick snapshot if something is actually happening (visuals or active missiles)
                            if (
                                tempProjectiles.some((p) => p.active) ||
                                tempVisuals.length > 0 ||
                                forceSnapshot
                            ) {
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
                                        itemType: v.itemType,
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

                // Persistence: Remaining Seekers become real entities for the next turn
                tempProjectiles.forEach((p) => {
                    const stats = ENTITY_STATS[p.type] || ENTITY_STATS[p.itemType];
                    // Only persist if seeker AND explicitly allowed to persist
                    if (p.active && stats?.isSeeker && stats?.persistsAcrossTurns) {
                        const data = { ...p };
                        delete data.active;
                        this.addEntity(data);
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
        const aliveTeams = new Set(alivePlayers.map((pid) => this.players[pid].team || pid));

        if (aliveTeams.size === 1) {
            this.winner = Array.from(aliveTeams)[0];
        } else if (aliveTeams.size === 0) {
            this.winner = 'DRAW';
        }

        // Napalm Refinement: Purge ALL internal-round-based hazards at end of resolveTurn
        // they should never persist across Planning phases.
        this.entities = this.entities.filter((e) => e.type !== 'NAPALM_FIRE');

        this.turn += 1;
        this.updateWindCycle();

        // Replenish Fuel and Recharge Shields for the next turn's planning phase
        this.entities.forEach((e) => {
            // 1. Passive Replenishment (Always happens)
            if (e.fuel !== undefined) {
                const regen = ENTITY_STATS[e.type]?.fuelRegen || 0;
                e.fuel = Math.min(e.maxFuel, e.fuel + regen);
            }

            // 2. Active System Recharge (Blocked by EMP/Disabled status)
            if (e.disabledUntilTurn >= this.turn) return;

            if (e.type === 'SHIELD') {
                const stats = ENTITY_STATS.SHIELD;
                e.barrierHp = Math.min(
                    stats.barrierHpMax,
                    (e.barrierHp || 0) + (stats.rechargeRate || 1)
                );
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
        return TorusMath.getLinkSegments(p1, p2, width, height);
    }

    /**
     * Slingshot Safety: Check if a proposed launch is too close in angle to existing connections.
     * Returns true if any connection (incoming or outgoing) is within 30 degrees.
     */
    static checkLinkAngleSeparation(
        itemType,
        sourceHubId,
        targetX,
        targetY,
        links,
        stagedActions,
        entities,
        map
    ) {
        // 0. Determine if this item type even creates a link.
        // Projectiles (Weapons, Bombs) do not create links and should not be denied by angle.
        const stats = ENTITY_STATS[itemType];
        const createsLink =
            ((stats?.damageFull === undefined && itemType !== 'RECLAIMER') ||
                stats?.landAsStructure) &&
            stats?.landAsStructure !== false;

        if (!createsLink) return false;

        const hub = entities.find((e) => String(e.id) === String(sourceHubId));
        if (!hub) {
            console.warn(`[AngleCheck] Hub not found for ID: ${sourceHubId}`);
            return false;
        }

        const width = map.width;
        const height = map.height;

        // 1. Calculate new launch angle (pointing AWAY from hub)
        const newVec = GameState.getToroidalVector(hub.x, hub.y, targetX, targetY, width, height);
        const newAngle = Math.atan2(newVec.dy, newVec.dx) * (180 / Math.PI);

        const isAngleTooTight = (otherX, otherY) => {
            const vec = GameState.getToroidalVector(hub.x, hub.y, otherX, otherY, width, height);
            const angle = Math.atan2(vec.dy, vec.dx) * (180 / Math.PI);
            let diff = Math.abs(newAngle - angle) % 360;
            if (diff > 180) diff = 360 - diff;
            return diff < 30;
        };

        // 2. Check existing links
        for (const link of links) {
            let otherId = null;
            if (String(link.from) === String(sourceHubId)) otherId = link.to;
            else if (String(link.to) === String(sourceHubId)) otherId = link.from;

            if (otherId) {
                const other = entities.find((e) => String(e.id) === String(otherId));
                if (other) {
                    const tooTight = isAngleTooTight(other.x, other.y);
                    if (tooTight) {
                        console.log(
                            `[AngleCheck] Denied: Angle too close to existing link to ${otherId}`
                        );
                        return true;
                    }
                }
            }
        }

        // 3. Check staged actions
        for (const action of stagedActions) {
            if (String(action.sourceId) === String(sourceHubId)) {
                // Only deny if the staged action is a structure launch (creates a link)
                const aStats = ENTITY_STATS[action.itemType];
                const actionCreatesLink =
                    ((aStats?.damageFull === undefined && action.itemType !== 'RECLAIMER') ||
                        aStats?.landAsStructure) &&
                    aStats?.landAsStructure !== false;
                if (!actionCreatesLink) continue;

                // Outgoing staged
                const pullDist = action.distance || 0;
                const launchDist = GameState.calculateLaunchDistance(pullDist);
                const rad = (action.angle * Math.PI) / 180;
                const tX = (hub.x + Math.cos(rad) * launchDist + width) % width;
                const tY = (hub.y + Math.sin(rad) * launchDist + height) % height;
                if (isAngleTooTight(tX, tY)) {
                    console.log(
                        `[AngleCheck] Denied: Angle too close to staged action from ${action.sourceId}`
                    );
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Point-to-Segment Distance Math (Toroidal Aware)
     * Returns the shortest physical distance from point (px, py) to line segment (x1, y1)-(x2, y2)
     */
    static getPointToSegmentDistance(px, py, x1, y1, x2, y2, width = 2000, height = 2000) {
        return TorusMath.getPointToSegmentDistance(px, py, x1, y1, x2, y2, width, height);
    }

    /**
     * Point-to-Segment Math Helper
     * Returns the closest point on segment (x1, y1)-(x2, y2) to (px, py)
     */
    static getPointOnSegment(px, py, x1, y1, x2, y2) {
        return TorusMath.getPointOnSegment(px, py, x1, y1, x2, y2);
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
            `[Explosion-Trace] Triggered at (${Math.round(x)}, ${Math.round(y)}) with radius ${stats.radiusFull} by a seeker`
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

            // EMP status application
            if (stats.itemType === 'EMP' && effDist <= FULL_RADIUS) {
                target.disabledUntilTurn = this.turn + 2;
                console.log(
                    `[EMP] ${target.id || target.type} DISABLED until Turn ${target.disabledUntilTurn}`
                );
            }

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

    triggerEchoArtillery(sourceX, sourceY, launcherId, round) {
        this.entities.forEach((ent) => {
            if (
                ent.type === 'ECHO_ARTILLERY' &&
                ent.owner !== launcherId &&
                ent.disabledUntilTurn <= this.turn &&
                !ent.firedThisTurn
            ) {
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

    /**
     * Updates an extractor's capture status based on nearby resource nodes.
     */
    updateExtractorStatus(entity) {
        if (entity.type !== 'EXTRACTOR') return;

        const node = this.map.resources.find(
            (res) =>
                this.getToroidalDistance(entity.x, entity.y, res.x, res.y) <=
                GLOBAL_STATS.RESOURCE_CAPTURE_RADIUS
        );

        if (node) {
            entity.isCapturing = true;
            entity.capturedNodeId = node.id;
        } else {
            entity.isCapturing = false;
            entity.capturedNodeId = null;
        }
    }
}

export default GameState;
