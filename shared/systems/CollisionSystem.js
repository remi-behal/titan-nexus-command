import { ENTITY_STATS, GLOBAL_STATS } from '../constants/EntityStats.js';
import * as TorusMath from '../utils/TorusMath.js';

/**
 * CollisionSystem encapsulates active defense interception, shield barriers,
 * and hazard proximity math in a stateless, modular package.
 */
export const CollisionSystem = {
    /**
     * Check if a projectile crosses a Shield barrier during its tick movement (The Crossing Rule).
     */
    checkShieldInterception(gameState, proj, prevX, prevY, tempVisuals, impacts) {
        gameState.entities.forEach((shield) => {
            if (!proj.active && !proj.hitThisTick) return;
            if (shield.type !== 'SHIELD' || shield.barrierHp <= 0) return;

            // Check if shield is disabled by EMP
            if (shield.disabledUntilTurn > gameState.turn) return;

            // Reclaimer Exception: Friendly management tools bypass shields
            if (proj.type === 'RECLAIMER' || proj.itemType === 'RECLAIMER') return;

            const sStats = ENTITY_STATS.SHIELD;
            const prevDist = TorusMath.getToroidalDistance(
                shield.x,
                shield.y,
                prevX,
                prevY,
                gameState.map.width,
                gameState.map.height
            );
            const currDist = TorusMath.getToroidalDistance(
                shield.x,
                shield.y,
                proj.currX,
                proj.currY,
                gameState.map.width,
                gameState.map.height
            );

            if (prevDist > sStats.range && currDist <= sStats.range) {
                // BLOCK!
                proj.active = false;
                proj.hitThisTick = false; // Prevent landing or detonation

                const pStats = ENTITY_STATS[proj.type] || ENTITY_STATS[proj.itemType];
                const isStructure =
                    proj.type === 'HUB' || proj.type === 'NUKE' || proj.type === 'EXTRACTOR';

                if (proj.itemType === 'EMP') {
                    // EMP detonates immediately on barrier impact
                    gameState.triggerExplosion(
                        proj.currX,
                        proj.currY,
                        pStats,
                        tempVisuals,
                        impacts,
                        gameState.entities
                    );
                } else if (!isStructure) {
                    const damage = pStats?.damageFull || 1;
                    shield.barrierHp -= damage;
                    if (shield.barrierHp < 0) shield.barrierHp = 0;

                    console.log(
                        `[Shield Hit] ${proj.id || proj.itemType} blocked by ${shield.id}. Shield HP: ${shield.barrierHp}`
                    );
                } else {
                    console.log(
                        `[Shield Structure Block] ${proj.id} destroyed by ${shield.id}. No damage to shield.`
                    );
                }

                // Visual effect
                tempVisuals.push({
                    type: 'SHIELD_HIT',
                    x: proj.currX,
                    y: proj.currY,
                    duration: 15
                });
            }
        });
    },

    /**
     * Check if a projectile collides with hazard zones like Napalm Fire or Explosion Hazards.
     */
    checkHazardCollision(gameState, proj, prevX, prevY, t) {
        if (!proj.active) return;

        const hazards = gameState.entities.filter(
            (e) => e.type === 'EXPLOSION_HAZARD' || e.type === 'NAPALM_FIRE'
        );
        hazards.forEach((h) => {
            const hStats = ENTITY_STATS[h.type];
            let isHit = false;

            if (h.type === 'NAPALM_FIRE') {
                const dist = TorusMath.getPointToSegmentDistance(
                    proj.currX,
                    proj.currY,
                    h.startX,
                    h.startY,
                    h.endX,
                    h.endY,
                    gameState.map.width,
                    gameState.map.height
                );
                // Projectile incineration uses its radius (size or default)
                if (dist <= hStats.width / 2 + (ENTITY_STATS[proj.type]?.size || 8)) isHit = true;
            } else {
                if (
                    TorusMath.lineCircleIntersection(
                        prevX,
                        prevY,
                        proj.currX,
                        proj.currY,
                        h.x,
                        h.y,
                        hStats.radius || 200,
                        gameState.map.width,
                        gameState.map.height
                    )
                ) {
                    isHit = true;
                }
            }

            if (isHit) {
                if (!proj.scheduledEffects.some((e) => e.sourceId === h.id)) {
                    const delay = 5 + Math.floor(Math.random() * 5);
                    proj.scheduledEffects.push({
                        type: 'incinerate',
                        tick: t + delay,
                        sourceId: h.id
                    });
                    console.log(
                        `[Hazard] Projectile ${proj.id} entry detected by ${h.type} at (${Math.round(h.x)}, ${Math.round(h.y)}). Delaying destruction.`
                    );
                }
            }
        });
    }
};
