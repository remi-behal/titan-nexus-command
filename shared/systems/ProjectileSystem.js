import { ENTITY_STATS, GLOBAL_STATS } from '../constants/EntityStats.js';
import * as TorusMath from '../utils/TorusMath.js';

/**
 * ProjectileSystem handles update, tracking, split, and landing logic for weapons,
 * interceptors, SAM missiles, and automated projectile units.
 */
export const ProjectileSystem = {
    /**
     * Updates a seeker/homing projectile (Weapon or Interceptor).
     * Handles target acquisition, tracking, movement, and proximity detonation.
     */
    updateSeekerProjectile(gameState, proj, stats, tempProjectiles) {
        // 1. Lifecycle Check: Ignite seeker at 50% distance
        if (!proj.searchMode && proj.totalDistanceMoved >= proj.intendedDistance * 0.5) {
            proj.searchMode = true;
        }

        // 2. Seeker Logic: Target Acquisition
        if (proj.searchMode && !proj.targetId) {
            let minDist = Infinity;
            let closestTarget = null;

            // Interceptors search through tempProjectiles (incoming weapons)
            // Homing weapons search through gameState.entities (enemy structures)
            const targets = stats.isInterceptor ? tempProjectiles : gameState.entities;

            targets.forEach((ent) => {
                if (ent.owner === proj.owner) return;

                // Filtering Logic
                if (stats.isInterceptor) {
                    // Interceptors target weapons/projectiles that are active (except other interceptors)
                    const entStats = ENTITY_STATS[ent.type] || ENTITY_STATS[ent.itemType];
                    if (!ent.active || entStats?.isInterceptor) return;
                } else {
                    // Weapons target structures (not projectiles/resources)
                    if (
                        ent.type === 'WEAPON' ||
                        ent.type === 'PROJECTILE' ||
                        ent.type === 'RESOURCE'
                    )
                        return;
                }

                const dist = TorusMath.getToroidalDistance(
                    proj.currX,
                    proj.currY,
                    ent.x !== undefined ? ent.x : ent.currX,
                    ent.y !== undefined ? ent.y : ent.currY,
                    gameState.map.width,
                    gameState.map.height
                );
                if (dist > stats.homingRange) return;

                const isCloaked = gameState.isPositionCloaked(
                    ent.owner,
                    ent.x !== undefined ? ent.x : ent.currX,
                    ent.y !== undefined ? ent.y : ent.currY
                );
                if (isCloaked) return;

                const vec = TorusMath.getToroidalVector(
                    proj.currX,
                    proj.currY,
                    ent.x !== undefined ? ent.x : ent.currX,
                    ent.y !== undefined ? ent.y : ent.currY,
                    gameState.map.width,
                    gameState.map.height
                );
                const angleToTarget = Math.atan2(vec.dy, vec.dx) * (180 / Math.PI);
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
                proj.searchMode = false; // Stop searching once locked
            }
        }

        // 3. Tracking Logic
        if (proj.targetId) {
            let target = gameState.entities.find((e) => e.id === proj.targetId);
            // Interceptors search in the active projectile list
            if (!target && stats?.isInterceptor) {
                target = tempProjectiles.find((p) => p.id === proj.targetId && p.active);
            }

            if (target && (target.hp > 0 || target.active)) {
                // Cloaking Check: Break lock if target enters a Cloaking Field
                const targetX = target.x !== undefined ? target.x : target.currX;
                const targetY = target.y !== undefined ? target.y : target.currY;

                if (gameState.isPositionCloaked(target.owner, targetX, targetY)) {
                    target = null; // Lose target
                }
            }

            if (target && (target.hp > 0 || target.active)) {
                // Accelerate if target is still active
                if (proj.velocity < stats.maxSpeed) {
                    proj.velocity = Math.min(stats.maxSpeed, proj.velocity + stats.acceleration);
                }

                const targetX = target.x !== undefined ? target.x : target.currX;
                const targetY = target.y !== undefined ? target.y : target.currY;

                // Save last known coordinates for persistence
                proj.targetX = targetX;
                proj.targetY = targetY;

                const vec = TorusMath.getToroidalVector(
                    proj.currX,
                    proj.currY,
                    targetX,
                    targetY,
                    gameState.map.width,
                    gameState.map.height
                );
                const angleToTarget = Math.atan2(vec.dy, vec.dx) * (180 / Math.PI);

                let diff = angleToTarget - proj.currentAngle;
                while (diff > 180) diff -= 360;
                while (diff < -180) diff += 360;

                // Toroidal flip protection
                if (Math.abs(diff) > 170) diff = 0;

                const turn = Math.sign(diff) * Math.min(Math.abs(diff), stats.turnRadius);
                proj.currentAngle += turn;
            } else {
                proj.lockFound = false; // Target lost

                // SMART LOGIC: Re-enable search and slow down
                if (stats.reacquire) {
                    proj.targetId = null;
                    proj.searchMode = true;
                    proj.velocity = GLOBAL_STATS.SPEED_TIERS.SLOW; // Slow down to conserve fuel
                }
            }
        } else if (proj.searchMode) {
            // Passive acceleration during search phase (unless smart and searching)
            const targetSpeed = stats.reacquire ? GLOBAL_STATS.SPEED_TIERS.SLOW : stats.maxSpeed;

            if (proj.velocity < targetSpeed) {
                proj.velocity = Math.min(targetSpeed, proj.velocity + stats.acceleration);
            } else if (proj.velocity > targetSpeed) {
                proj.velocity = Math.max(targetSpeed, proj.velocity - stats.acceleration);
            }
        }

        // 4. Step-based Movement
        const moveDist = proj.velocity;
        const rad = (proj.currentAngle || 0) * (Math.PI / 180);
        const windX = gameState.windState?.active ? gameState.windState.dx : 0;
        const windY = gameState.windState?.active ? gameState.windState.dy : 0;
        proj.currX = TorusMath.wrapX(proj.currX + Math.cos(rad) * moveDist + windX, gameState.map.width);
        proj.currY = TorusMath.wrapY(proj.currY + Math.sin(rad) * moveDist + windY, gameState.map.height);
        proj.totalDistanceMoved += moveDist;

        // 5. Fuel & Endurance Checks
        const fuelLimit = proj.intendedDistance * 0.5 + (stats.homingFuel || 400);
        if (proj.totalDistanceMoved >= fuelLimit) {
            proj.active = false;
            proj.hitThisTick = true;
        }

        // 6. Impact Triggering (Proximity)
        if (proj.targetId) {
            let target = gameState.entities.find((e) => e.id === proj.targetId);
            if (!target && stats?.isInterceptor) {
                target = tempProjectiles.find((p) => p.id === proj.targetId && p.active);
            }

            if (target && (target.hp > 0 || target.active)) {
                const tx = target.x !== undefined ? target.x : target.currX;
                const ty = target.y !== undefined ? target.y : target.currY;
                const actualDist = TorusMath.getToroidalDistance(
                    proj.currX,
                    proj.currY,
                    tx,
                    ty,
                    gameState.map.width,
                    gameState.map.height
                );

                const targetStats = ENTITY_STATS[target.type] || ENTITY_STATS[target.itemType];
                const hitDist = (targetStats?.size || 10) + 2;

                if (actualDist <= hitDist) {
                    proj.active = false;
                    proj.hitThisTick = true;
                }
            } else if (proj.targetX !== undefined && !stats?.reacquire) {
                // Target lost: detonate at last known coordinates
                const actualDist = TorusMath.getToroidalDistance(
                    proj.currX,
                    proj.currY,
                    proj.targetX,
                    proj.targetY,
                    gameState.map.width,
                    gameState.map.height
                );
                if (actualDist <= 15) {
                    proj.active = false;
                    proj.hitThisTick = true;
                }
            }
        }
    },

    /**
     * Updates linear trajectory path, cluster bomb segment triggers,
     * and final landing sequence for standard projectiles.
     */
    updateStandardProjectile(
        gameState,
        proj,
        t,
        round,
        tempProjectiles,
        tempVisuals,
        impacts,
        overloadedThisRound,
        snapshots
    ) {
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
                proj.intendedDx * proj.intendedDx + proj.intendedDy * proj.intendedDy
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

                const splitX = proj.startX + proj.intendedDx * (t / proj.arrivalTick);
                const splitY = proj.startY + proj.intendedDy * (t / proj.arrivalTick);

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
                    type: 'CLUSTER_FRAGMENT', // Use fragment visual for sub-munitions
                    startX: subStartX,
                    startY: subStartY,
                    intendedDx: subIntendedDx,
                    intendedDy: subIntendedDy,
                    active: true,
                    hasSplit: true, // Prevent re-splitting
                    hitByFlakDefense: new Set() // Fresh flak state for sub-bombs
                });
            }
        }

        const progress = t / proj.arrivalTick;

        let windX = 0;
        let windY = 0;
        if (gameState.windState?.active) {
            windX = gameState.windState.dx * t;
            windY = gameState.windState.dy * t;
        }

        if (t < proj.arrivalTick) {
            // Use explicit intended vector to avoid "Shortest Path" directional flips
            proj.currX = TorusMath.wrapX(
                proj.startX + proj.intendedDx * progress + windX,
                gameState.map.width
            );
            proj.currY = TorusMath.wrapY(
                proj.startY + proj.intendedDy * progress + windY,
                gameState.map.height
            );
        } else if (t === proj.arrivalTick) {
            // Final arrival precisely at arrivalTick
            const finalWindX = gameState.windState?.active ? gameState.windState.dx * proj.arrivalTick : 0;
            const finalWindY = gameState.windState?.active ? gameState.windState.dy * proj.arrivalTick : 0;
            proj.currX = TorusMath.wrapX(proj.startX + proj.intendedDx + finalWindX, gameState.map.width);
            proj.currY = TorusMath.wrapY(proj.startY + proj.intendedDy + finalWindY, gameState.map.height);
            proj.active = false;
            proj.hitThisTick = true;

            if (proj.type === 'RECLAIMER') {
                gameState.handleReclaim(proj.currX, proj.currY, proj.owner, tempVisuals, impacts);
            }
            const stats = ENTITY_STATS[proj.type];
            // landAsStructure: false avoids duplicate entities for weapons like Napalm
            if (
                ((stats?.damageFull === undefined && proj.type !== 'RECLAIMER') ||
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
                const newEnt = gameState.addEntity(data);

                // Spawn a transient visual structure landing event for audio and visual replication
                tempVisuals.push({
                    id: `land-${Math.random()}`,
                    type: 'STRUCTURE_LANDING',
                    itemType: proj.type,
                    owner: proj.owner,
                    x: proj.currX,
                    y: proj.currY,
                    duration: 3
                });

                if (
                    data.sourceId &&
                    data.intendedDx !== undefined &&
                    data.intendedDy !== undefined
                ) {
                    gameState.addLink(
                        data.sourceId,
                        newEnt.id,
                        data.owner,
                        data.intendedDx,
                        data.intendedDy
                    );
                }
            }

            // --- Napalm Special Logic (Always deploy fire on arrival) ---
            if (proj.type === 'NAPALM') {
                const nStats = ENTITY_STATS.NAPALM_FIRE;
                gameState.addEntity({
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

                // Push specialized landing snapshot for visual feedback
                snapshots.push({
                    type: 'LANDING',
                    tick: t,
                    round: round,
                    playerId: proj.owner,
                    itemType: proj.type,
                    state: gameState.getState()
                });
            }

            if (proj.type === 'OVERLOAD' && proj.hitThisTick) {
                gameState.triggerOverload(
                    proj.currX,
                    proj.currY,
                    stats,
                    tempVisuals,
                    impacts,
                    overloadedThisRound
                );
                proj.hitThisTick = false;
            }

            if (stats?.damageFull !== undefined && !stats?.landAsStructure && proj.hitThisTick) {
                const potentialTargets = [
                    ...gameState.entities,
                    ...tempProjectiles.filter((p) => p.active)
                ];

                gameState.triggerExplosion(
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
};
