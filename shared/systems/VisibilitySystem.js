import { ENTITY_STATS, ENTITY_TYPES } from '../constants/EntityStats.js';
import * as TorusMath from '../utils/TorusMath.js';

export const VisibilitySystem = {
    /**
     * Checks if a specific coordinate is visible to a player.
     * Accounts for toroidal wrapping.
     */
    isPositionVisible(gameState, playerId, x, y, entities = null) {
        if (!playerId || playerId === 'spectator') return true;

        const sourceEntities = entities || gameState.entities;
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

            const ex = e.currX !== undefined ? e.currX : e.x;
            const ey = e.currY !== undefined ? e.currY : e.y;

            const dist = TorusMath.getToroidalDistance(
                ex,
                ey,
                x,
                y,
                gameState.map.width,
                gameState.map.height
            );
            if (dist > radius) return false;

            // Projectile-Specific Vision Override: 60 degree cone
            // NOTE: A projectile ALWAYS sees its own position (dist < 1)
            if (
                dist > 1 &&
                (e.type === 'PROJECTILE' || e.type === 'HOMING_MISSILE') &&
                (e.itemType === 'HOMING_MISSILE' || e.type === 'HOMING_MISSILE')
            ) {
                const vec = TorusMath.getToroidalVector(
                    ex,
                    ey,
                    x,
                    y,
                    gameState.map.width,
                    gameState.map.height
                );
                const angleToPoint = Math.atan2(vec.dy, vec.dx) * (180 / Math.PI);

                let diff = angleToPoint - (e.currentAngle || 0);
                while (diff > 180) diff -= 360;
                while (diff < -180) diff += 360;

                return Math.abs(diff) <= (stats.searchCone || 60) / 2;
            }

            return true;
        });
    },

    /**
     * Helper to check if a position is protected by a Cloaking Field.
     */
    isPositionCloaked(gameState, ownerId, x, y, entities = null) {
        const sourceEntities = entities || gameState.entities;
        return sourceEntities.some((e) => {
            if (
                e.owner === ownerId &&
                e.type === 'CLOAKING_FIELD' &&
                e.deployed !== false &&
                (e.disabledUntilTurn || 0) <= gameState.turn
            ) {
                const ex = e.currX !== undefined ? e.currX : e.x;
                const ey = e.currY !== undefined ? e.currY : e.y;
                const dist = TorusMath.getToroidalDistance(
                    ex,
                    ey,
                    x,
                    y,
                    gameState.map.width,
                    gameState.map.height
                );
                return dist <= (ENTITY_STATS.CLOAKING_FIELD.cloakRange || 300);
            }
            return false;
        });
    },

    /**
     * Returns a list of vision circles { x, y, radius } for a given player.
     */
    getVisionCircles(gameState, playerId) {
        if (!playerId || playerId === 'spectator') return [];

        return gameState.entities
            .filter((e) => e.owner === playerId)
            .map((e) => {
                // Consistent statKey logic with isPositionVisible
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

                return {
                    x: e.x,
                    y: e.y,
                    radius
                };
            })
            .filter((c) => c.radius > 0);
    },

    /**
     * Updates the 'scouted' status of all entities based on current vision.
     */
    updateScouting(gameState, extraEntities = []) {
        const observerIds = Object.keys(gameState.players);
        const allEntities = [...gameState.entities, ...extraEntities];

        gameState.entities.forEach((ent) => {
            if (ent.scouted) return;

            for (const observerId of observerIds) {
                if (ent.owner === observerId) continue;

                const ex = ent.currX !== undefined ? ent.currX : ent.x;
                const ey = ent.currY !== undefined ? ent.currY : ent.y;

                // Cloaking Check: Follows logic from getVisibleState
                const isCloaked = this.isPositionCloaked(gameState, ent.owner, ex, ey, allEntities);
                if (isCloaked) {
                    const detectionRange = ENTITY_STATS.CLOAKING_FIELD.detectionRange || 75;
                    const canSee = allEntities.some((e) => {
                        if (e.owner !== observerId) return false;
                        const observerX = e.currX !== undefined ? e.currX : e.x;
                        const observerY = e.currY !== undefined ? e.currY : e.y;
                        const dist = TorusMath.getToroidalDistance(
                            observerX,
                            observerY,
                            ex,
                            ey,
                            gameState.map.width,
                            gameState.map.height
                        );
                        return dist <= detectionRange;
                    });
                    if (canSee) {
                        ent.scouted = true;
                        break;
                    }
                } else {
                    // Standard Vision
                    if (this.isPositionVisible(gameState, observerId, ex, ey, allEntities)) {
                        ent.scouted = true;
                        break;
                    }
                }
            }
        });
    },

    /**
     * Returns a filtered version of the state based on what a player can see.
     */
    getVisibleState(gameState, playerId, baseState = null) {
        const state = baseState ? JSON.parse(JSON.stringify(baseState)) : gameState.getState();
        if (!playerId || playerId === 'spectator') {
            state.entities = state.entities.map((e) => ({ ...e, scouted: true }));
            return state;
        }

        const isVisible = (x, y, targetOwnerId = null) => {
            if (
                targetOwnerId &&
                targetOwnerId !== playerId &&
                this.isPositionCloaked(gameState, targetOwnerId, x, y, state.entities)
            ) {
                // Cloaked: only visible at detectionRange (75px)
                const detectionRange = ENTITY_STATS.CLOAKING_FIELD.detectionRange || 75;
                return state.entities.some((e) => {
                    if (e.owner !== playerId) return false;
                    const ex = e.currX !== undefined ? e.currX : e.x;
                    const ey = e.currY !== undefined ? e.currY : e.y;
                    const dist = TorusMath.getToroidalDistance(
                        ex,
                        ey,
                        x,
                        y,
                        state.map.width,
                        state.map.height
                    );
                    return dist <= detectionRange;
                });
            }
            return this.isPositionVisible(gameState, playerId, x, y, state.entities);
        };

        const entitiesRequiredByLinks = new Set();

        // Filter links: visible if either end is visible, or if any segment is visible
        const sourceEntities = baseState ? baseState.entities : gameState.entities;

        state.links = state.links.filter((l) => {
            const fullFrom = sourceEntities.find((e) => e.id === l.from);
            const fullTo = sourceEntities.find((e) => e.id === l.to);
            if (!fullFrom || !fullTo) return false;

            // Check endpoints
            const fromVisible =
                fullFrom.owner === playerId || isVisible(fullFrom.x, fullFrom.y, fullFrom.owner);
            const toVisible =
                fullTo.owner === playerId || isVisible(fullTo.x, fullTo.y, fullTo.owner);

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
                const sx = TorusMath.wrapX(fullFrom.x + dx * ratio, state.map.width);
                const sy = TorusMath.wrapY(fullFrom.y + dy * ratio, state.map.height);
                if (isVisible(sx, sy, l.owner)) {
                    entitiesRequiredByLinks.add(l.from);
                    entitiesRequiredByLinks.add(l.to);
                    return true;
                }
            }

            return false;
        });

        // Filter entities: own entities always visible, others only if in vision OR required by a visible link OR ghost memory
        state.entities = sourceEntities
            .map((e) => {
                const isOwn = e.owner === playerId;
                const inVision = isVisible(e.x, e.y, e.owner);
                const isLinkEndpoint = entitiesRequiredByLinks.has(e.id);
                // Standard vision: can we see this spot?
                const canSeeSpot = this.isPositionVisible(gameState, playerId, e.x, e.y, sourceEntities);

                // Conditions to return entity:
                if (isOwn || inVision || isLinkEndpoint || (e.scouted && !canSeeSpot)) {
                    return {
                        ...e,
                        scouted: isOwn || inVision || e.scouted
                    };
                }
                return null;
            })
            .filter((e) => e !== null);

        state.audibleEvents = [];
        if (playerId && playerId !== 'spectator') {
            const isAudible = (x, y) => {
                return sourceEntities.some((playerEnt) => {
                    if (playerEnt.owner !== playerId) return false;
                    const isStructure = ENTITY_STATS[playerEnt.type]?.type === 'STRUCTURE';
                    if (!isStructure) return false;
                    
                    const dist = TorusMath.getToroidalDistance(
                        playerEnt.x,
                        playerEnt.y,
                        x,
                        y,
                        state.map.width,
                        state.map.height
                    );
                    return dist <= 1000;
                });
            };

            sourceEntities.forEach((e) => {
                const isSoundEvent = 
                    e.type === 'PROJECTILE' ||
                    e.type === 'LASER_BEAM' ||
                    e.type === 'EXPLOSION' ||
                    e.type === 'SHIELD_HIT' ||
                    e.type === 'LINK_COLLISION' ||
                    e.type === 'SPARK' ||
                    e.type === 'STRUCTURE_LANDING' ||
                    (e.deployed === false && ENTITY_STATS[e.type]?.type === 'STRUCTURE');
                
                if (isSoundEvent) {
                    const inVision = isVisible(e.x, e.y, e.owner);
                    if (!inVision && isAudible(e.x, e.y)) {
                        state.audibleEvents.push({
                            id: e.id,
                            type: e.type,
                            itemType: e.itemType,
                            x: e.x,
                            y: e.y
                        });
                    }
                }
            });
        }

        return state;
    }
};
