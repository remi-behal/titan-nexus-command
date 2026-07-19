import {
    ENTITY_STATS,
    GLOBAL_STATS,
    ENTITY_TYPES
} from '../../../../shared/constants/EntityStats.js';
import { GameState } from '../../../../shared/GameState.js';
import { VISUAL_STATS } from '../../constants/VisualStats.js';
import { getGhostColor } from '../../utils/RenderingHelpers.js';
import { drawShape, drawField } from '../../utils/ShapeRenderer.js';
import { SHAPES } from '../../constants/ShapeDefinitions.js';
import * as TorusMath from '../../../../shared/utils/TorusMath.js';
import { shouldHighlightRing } from '../../utils/uiLogic.js';

function getSeededRandom(seedString) {
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
        hash = seedString.charCodeAt(i) + ((hash << 5) - hash);
    }
    return () => {
        const x = Math.sin(hash++) * 10000;
        return x - Math.floor(x);
    };
}

const drawToroidalLine = (ctx, x1, y1, x2, y2, width, height, forceDx = null, forceDy = null) => {
    const dx = forceDx !== null ? forceDx : x2 - x1;
    const dy = forceDy !== null ? forceDy : y2 - y1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + dx, y1 + dy);
    ctx.stroke();
};

export function drawEntities(
    ctx,
    visualEntities,
    currentGameState,
    myPlayerId,
    viewBounds,
    offsetOffsetX,
    offsetOffsetY,
    isInVision,
    selectedHubId,
    launchMode,
    isAiming,
    mousePos,
    maxPullDistance,
    selectedItemType,
    showDebugPreview,
    committedActions,
    isSandbox = false
) {
    const { viewL, viewR, viewT, viewB } = viewBounds;
    const mapW = currentGameState.map.width;
    const mapH = currentGameState.map.height;
    const HUB_RADIUS = ENTITY_STATS.HUB.size;
    const SLING_RING_RADIUS = GLOBAL_STATS.SLING_RING_RADIUS;
    const RING_INTERACTION_BUFFER = GLOBAL_STATS.RING_INTERACTION_BUFFER;

    const getStrengthColor = (ratio) => {
        let r,
            g = 0;
        const b = 0;
        if (ratio < 0.5) {
            const segmentRatio = ratio * 2;
            r = Math.floor(255 * segmentRatio);
            g = Math.floor(255 - 90 * segmentRatio);
        } else {
            const segmentRatio = (ratio - 0.5) * 2;
            r = 255;
            g = Math.floor(165 * (1 - segmentRatio));
        }
        return `rgb(${r}, ${g}, ${b})`;
    };

    const getToroidalDistVector = (x1, y1, x2, y2, w, h) =>
        TorusMath.getToroidalVector(x1, y1, x2, y2, w, h);
    const getToroidalDist = (x1, y1, x2, y2, w, h) =>
        TorusMath.getToroidalDistance(x1, y1, x2, y2, w, h);

    // Dynamic extraction start
    // 5. DRAW ENTITIES
    Object.values(visualEntities).forEach((entity) => {
        // FRUSTUM CULLING: Skip if entity is outside viewport bounds
        const stats = ENTITY_STATS[entity.itemType || entity.type];
        const isProjectile =
            entity.type === 'PROJECTILE' ||
            entity.type === 'NAPALM' ||
            (stats?.damageFull !== undefined && (entity.type !== 'NUKE' || !entity.detonationTurn));
        const radius = stats?.size || (isProjectile ? GLOBAL_STATS.PROJECTILE_RADIUS || 10 : 20);

        // Include larger visual effects in the culling check so they don't clip at the screen edges
        let cullingRadius = radius;
        if (stats) {
            if (stats.vision) cullingRadius = Math.max(cullingRadius, stats.vision);
            if (stats.range) cullingRadius = Math.max(cullingRadius, stats.range);
            if (stats.cloakRange) cullingRadius = Math.max(cullingRadius, stats.cloakRange);
            if (stats.homingRange) cullingRadius = Math.max(cullingRadius, stats.homingRange);
        }
        if (entity.radius) cullingRadius = Math.max(cullingRadius, entity.radius);

        if (
            entity.x + offsetOffsetX + cullingRadius < viewL ||
            entity.x + offsetOffsetX - cullingRadius > viewR ||
            entity.y + offsetOffsetY + cullingRadius < viewT ||
            entity.y + offsetOffsetY - cullingRadius > viewB
        )
            return;

        const player = currentGameState.players[entity.owner];
        let color = player ? player.color : '#fff';

        const isDisabled = entity.disabledUntilTurn > currentGameState.turn;

        // Bug 2 fix: An entity should display as a "ghost" (desaturated) if it's
        // NOT in active vision, even if it's still in the server state (e.g. as a link endpoint).
        const currentlyInVision = isInVision(entity.x, entity.y);
        const displayAsGhost = entity.isGhost || !currentlyInVision;

        if (displayAsGhost) {
            // Desaturate the color for ghosts (Bug 1 fix)
            color = getGhostColor(color, VISUAL_STATS.FOG_OF_WAR.GHOST_SATURATION);
        }

        const isSelected = entity.id === selectedHubId && !displayAsGhost;
        const isUndeployed = entity.deployed === false;

        // DRAWING GUARD: Only render the entity if it is scouted (active vision/owned)
        // or if it's a ghost (previously scouted).
        // This prevents enemy hubs at link endpoints from being visible in the dark.
        if (!isSandbox && entity.scouted === false && !entity.isGhost) return;

        ctx.save();

        // APPLY EMP JITTER (inside save/restore block to prevent cumulative drift)
        if (isDisabled && !displayAsGhost) {
            const eStats = VISUAL_STATS.EMP;
            const tSeed = Math.floor(Date.now() / (eStats.jitterFrequency || 60));
            const dx = Math.sin(tSeed * 12.98) * (eStats.jitterMagnitude || 2);
            const dy = Math.cos(tSeed * 43.21) * (eStats.jitterMagnitude || 2);
            ctx.translate(dx, dy);

            if (Math.random() > (eStats.flickerRate || 0.7)) {
                color = Math.random() > 0.5 ? eStats.color : eStats.secondaryColor;
            }
        }

        ctx.fillStyle = color;
        ctx.globalAlpha = displayAsGhost ? 0.4 : isUndeployed ? 0.5 : 1.0;

        if (isSelected) {
            // shadow removed
        }

        if (isUndeployed) {
            ctx.setLineDash([2, 2]);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
        }

        if (isProjectile) {
            ctx.save();

            // 1. Draw Search Beam (faint cone)
            if (entity.searchMode) {
                drawField(
                    ctx,
                    entity.x,
                    entity.y,
                    'VISION_CONE',
                    stats?.homingRange || 400,
                    color,
                    displayAsGhost,
                    Date.now(),
                    stats?.searchCone || 60,
                    entity.currentAngle || 0
                );
            }

            // 2. Draw Vectorized Projectile Trail (Missiles only)
            const typeForTrail = entity.itemType || entity.type;
            const hasTrail =
                typeForTrail === 'HOMING_MISSILE' ||
                typeForTrail === 'SAM_MISSILE' ||
                typeForTrail === 'SMART_SAM_MISSILE';

            if (!displayAsGhost && hasTrail) {
                ctx.save();
                const rad =
                    ((entity.angle !== undefined ? entity.angle : entity.currentAngle || 0) *
                        Math.PI) /
                        180 +
                    Math.PI / 2;
                ctx.translate(entity.x, entity.y);
                ctx.rotate(rad);

                ctx.strokeStyle = color;
                ctx.lineWidth = 1;

                // Draw 3 fading trail segments
                for (let i = 1; i <= 3; i++) {
                    ctx.globalAlpha = 0.8 / i;
                    const offset = i * 12;
                    ctx.beginPath();
                    ctx.moveTo(0, offset);
                    ctx.lineTo(0, offset + 8);
                    ctx.stroke();
                }
                ctx.restore();
            }

            // 3. Draw Projectile Body
            if (entity.itemType === 'HOMING_MISSILE') {
                // Offset by PI/2 because the shape is defined pointing UP [0, -1],
                // but 0 degrees in rotation is RIGHT [1, 0].
                const rotation =
                    ((entity.angle !== undefined ? entity.angle : entity.currentAngle || 0) *
                        Math.PI) /
                        180 +
                    Math.PI / 2;
                drawShape(
                    ctx,
                    entity.x,
                    entity.y,
                    'MISSILE',
                    radius,
                    color,
                    rotation,
                    displayAsGhost
                );
            } else if (entity.type === 'NUKE' || entity.itemType === 'NUKE') {
                drawShape(ctx, entity.x, entity.y, 'NUKE_FLYING', radius, color, 0, displayAsGhost);
            } else {
                const rotation =
                    ((entity.angle !== undefined ? entity.angle : entity.currentAngle || 0) *
                        Math.PI) /
                        180 +
                    Math.PI / 2;
                const typeKey = entity.itemType || entity.type;
                const shapeKey = SHAPES[typeKey] ? typeKey : 'PROJECTILE_SMALL';
                drawShape(
                    ctx,
                    entity.x,
                    entity.y,
                    shapeKey,
                    radius,
                    color,
                    rotation,
                    displayAsGhost
                );
            }
            ctx.restore();
        } else if (entity.type === 'LASER_BEAM') {
            // Draw Laser Beam
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(entity.x, entity.y);
            ctx.lineTo(entity.targetX, entity.targetY);
            ctx.strokeStyle = '#f0f'; // Magenta laser
            ctx.lineWidth = GLOBAL_STATS.LASER_BEAM_WIDTH;
            // shadow removed
            ctx.stroke();

            // Add a glow effect
            ctx.globalAlpha = 0.5;
            ctx.lineWidth = 6;
            ctx.stroke();
            ctx.restore();
        } else if (entity.type === 'SPARK') {
            drawShape(ctx, entity.x, entity.y, 'SPARK', 10, '#fff', 0, displayAsGhost);
        } else if (entity.type === 'RECLAIM') {
            const radius = entity.radius || 75;
            drawField(ctx, entity.x, entity.y, 'SHIELD_DOME', radius, '#00ffff', displayAsGhost);
        } else if (entity.type === 'EXPLOSION') {
            const explosionRadius = entity.radius || 40;
            const vStats = VISUAL_STATS[entity.itemType] || {};
            const baseColor = vStats.color || '#ff9900';
            
            // Calculate animation progress
            const maxDuration = entity.maxDuration || 40;
            const durationMs = maxDuration * 60; // 60ms per subtick
            const age = Date.now() - (entity.spawnTime || Date.now());
            const progress = Math.min(1.0, Math.max(0.0, age / durationMs));
            
            // Scaled radii and alpha fade
            const pFast = Math.pow(progress, 0.2);
            const pOuter = Math.pow(progress, 0.4);
            const alpha = displayAsGhost ? 0.3 : Math.max(0, 1 - progress * progress);
            const lineWidth = Math.max(0.5, 3 * (1 - progress));
            
            ctx.save();
            ctx.globalAlpha = alpha;
            if (!displayAsGhost) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = baseColor;
            }
            
            // 1. Solid Core (White) expanding to 20% of max radius
            ctx.beginPath();
            ctx.arc(entity.x, entity.y, explosionRadius * 0.2 * pFast, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            
            // 2. Hollow Outer Ring expanding to full max radius
            ctx.beginPath();
            ctx.arc(entity.x, entity.y, explosionRadius * pOuter, 0, Math.PI * 2);
            ctx.strokeStyle = baseColor;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
            
            ctx.restore();
        } else if (entity.type === 'SHIELD_HIT') {
            drawShape(
                ctx,
                entity.x,
                entity.y,
                'SHIELD_HIT',
                entity.radius || 15,
                '#00ffff',
                0,
                displayAsGhost
            );
        } else if (entity.type === 'EXPLOSION_HAZARD') {
            const radius = entity.radius || 200;
            drawField(ctx, entity.x, entity.y, 'SHIELD_DOME', radius, '#ff4500', displayAsGhost);
        } else if (entity.type === 'NAPALM_FIRE') {
            ctx.save();
            const stats = ENTITY_STATS.NAPALM_FIRE;
            const time = Date.now() / 1000;
            const pulse = 1 + Math.sin(time * 10) * 0.03;
            const width = stats.width * pulse;
            const radius = width / 2;

            // Calculate shortest toroidal vector to determine orientation
            const { dx, dy } = getToroidalDistVector(
                entity.startX,
                entity.startY,
                entity.endX,
                entity.endY,
                mapW,
                mapH
            );
            const angle = Math.atan2(dy, dx);
            const length = Math.sqrt(dx * dx + dy * dy);

            ctx.translate(entity.startX, entity.startY);
            ctx.rotate(angle);

            // Vectorized Napalm: Draw repeating 'licks' along the hazard length
            const lickCount = Math.max(3, Math.floor(length / 20));
            const spacing = length / (lickCount - 1);

            ctx.fillStyle = '#ff4500';
            for (let i = 0; i < lickCount; i++) {
                const progress = i / (lickCount - 1);
                const flicker = 0.8 + Math.sin(time * 10 + i) * 0.2;
                drawShape(
                    ctx,
                    i * spacing,
                    0,
                    'NAPALM_LICK',
                    radius * flicker,
                    `rgba(255, ${69 + progress * 71}, 0, ${0.8 - progress * 0.4})`,
                    Math.PI / 2, // Rotate lick to point perpendicular
                    displayAsGhost
                );
            }
            ctx.restore();
        } else if (entity.type === 'LINK_COLLISION') {
            drawShape(ctx, entity.x, entity.y, 'SPARK', 25, '#00ffff', 0, displayAsGhost);
        } else {
            // Non-Projectile Entities (Structures, Hazards, etc.)
            if (entity.type === 'LASER_POINT_DEFENSE' || entity.type === 'FLAK_DEFENSE') {
                ctx.beginPath();
                ctx.rect(entity.x - radius, entity.y - radius, radius * 2, radius * 2);
                ctx.fill();

                // --- Flak Defense Wall Visuals ---
                if (entity.type === 'FLAK_DEFENSE' && entity.flakActive) {
                    ctx.save();
                    const stats = ENTITY_STATS.FLAK_DEFENSE;
                    const arcRange = stats.range;
                    const arcWidth = (stats.arc * Math.PI) / 180;
                    const centerAngle = (entity.flakAngle * Math.PI) / 180;

                    // 1. Draw Sensor Cone (persistent faint arc)
                    ctx.save();
                    ctx.globalAlpha = 0.1;
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.moveTo(entity.x, entity.y);
                    ctx.arc(
                        entity.x,
                        entity.y,
                        arcRange,
                        centerAngle - arcWidth / 2,
                        centerAngle + arcWidth / 2
                    );
                    ctx.fill();
                    ctx.restore();

                    // 2. Draw multiple random small "explosions" in the arc
                    ctx.save();
                    ctx.globalAlpha = 0.4;
                    const timeBucket = Math.floor(Date.now() / 83);
                    const getSeededRandom = (seed) => {
                        const x = Math.sin(seed) * 10000;
                        return x - Math.floor(x);
                    };
                    let patternSeed =
                        entity.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) +
                        timeBucket;

                    for (let i = 0; i < 8; i++) {
                        const r = getSeededRandom(patternSeed++) * arcRange;
                        const theta =
                            centerAngle + (getSeededRandom(patternSeed++) - 0.5) * arcWidth;
                        const ex = entity.x + Math.cos(theta) * r;
                        const ey = entity.y + Math.sin(theta) * r;
                        const eSize = 4 + getSeededRandom(patternSeed++) * 8;

                        ctx.beginPath();
                        ctx.arc(ex, ey, eSize, 0, Math.PI * 2);
                        const colorIdx = Math.floor(getSeededRandom(patternSeed++) * 3);
                        ctx.fillStyle =
                            colorIdx === 0 ? '#cc6655' : colorIdx === 1 ? '#ccaa66' : '#cccc77';
                        ctx.shadowBlur = 5;
                        ctx.shadowColor = '#884433';
                        ctx.fill();
                    }
                    ctx.restore();
                    ctx.restore();
                }
            } else if (ENTITY_STATS[entity.type]?.type === ENTITY_TYPES.STRUCTURE) {
                const shapeKey = entity.type; // Use the entity type directly as the shape key

                if (entity.type === 'SHIELD') {
                    const structureWarning = entity.hp <= 1;
                    const domeWarning = entity.barrierHp !== undefined && entity.barrierHp <= 1;

                    drawShape(
                        ctx,
                        entity.x,
                        entity.y,
                        shapeKey,
                        radius,
                        color,
                        0,
                        displayAsGhost,
                        structureWarning
                    );

                    // Shield Bubble (Standardized Field)
                    if (entity.barrierHp > 0 && !isDisabled) {
                        drawField(
                            ctx,
                            entity.x,
                            entity.y,
                            'SHIELD_DOME',
                            ENTITY_STATS.SHIELD.range,
                            '#00ffff',
                            displayAsGhost,
                            Date.now(),
                            60,
                            0,
                            domeWarning
                        );
                    }
                } else {
                    const isWarning = entity.hp <= 1;
                    drawShape(
                        ctx,
                        entity.x,
                        entity.y,
                        shapeKey,
                        radius,
                        color,
                        0,
                        displayAsGhost,
                        isWarning
                    );

                    // Cloak Field (Standardized Field)
                    if (entity.type === 'CLOAKING_FIELD') {
                        drawField(
                            ctx,
                            entity.x,
                            entity.y,
                            'CLOAK_FIELD',
                            ENTITY_STATS.CLOAKING_FIELD.cloakRange || 300,
                            color,
                            displayAsGhost
                        );
                    }
                }
            } else if (entity.type === 'NUKE') {
                // Enhanced Nuke Icon (Landed)
                ctx.save();
                ctx.translate(entity.x, entity.y);
                const remainingTurns = (entity.detonationTurn || 0) - currentGameState.turn;
                const isDetonating = remainingTurns <= 0;
                const isCritical = remainingTurns <= 1;

                // Pulse math -> Flash logic
                const pulseSpeed = isDetonating ? 50 : isCritical ? 150 : 300;
                const nukeWarning = Math.sin(Date.now() / pulseSpeed) > 0;

                // 1. Aura (flicker via drawField)
                drawField(
                    ctx,
                    0,
                    0,
                    'SHIELD_DOME',
                    radius * 2.2,
                    isDetonating ? '#ff0000' : '#f1c40f',
                    displayAsGhost,
                    Date.now(),
                    60,
                    0,
                    nukeWarning
                );

                // 2. Main Body (flicker via drawShape)
                drawShape(
                    ctx,
                    0,
                    0,
                    'NUKE_FLYING',
                    radius,
                    isDetonating ? '#ff0000' : '#f39c12',
                    0,
                    displayAsGhost,
                    nukeWarning
                );

                // 3. Integrated Countdown / Label
                ctx.save();
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${radius * (isDetonating ? 0.6 : 0.9)}px Orbitron, Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                // shadow removed
                if (isDetonating) {
                    ctx.fillText('CRITICAL', 0, 0);
                } else if (remainingTurns > 0) {
                    ctx.fillText(remainingTurns.toString(), 0, 0);
                }
                ctx.restore();

                // 4. Detonation Radius Preview (Standardized Field)
                if (entity.owner === myPlayerId) {
                    drawField(
                        ctx,
                        entity.x - entity.x,
                        entity.y - entity.y,
                        'SHIELD_DOME',
                        ENTITY_STATS.NUKE.radiusFull,
                        'rgba(255, 50, 50, 0.4)',
                        displayAsGhost
                    );
                }
                ctx.restore();
            } else {
                if (entity.itemType === 'RECLAIMER') {
                    drawShape(
                        ctx,
                        entity.x,
                        entity.y,
                        'RECLAIMER',
                        radius,
                        color,
                        0,
                        displayAsGhost
                    );
                } else {
                    drawShape(
                        ctx,
                        entity.x,
                        entity.y,
                        entity.type,
                        radius,
                        color,
                        0,
                        displayAsGhost
                    );
                }
            }
            if (isUndeployed) {
                drawField(
                    ctx,
                    entity.x,
                    entity.y,
                    'CLOAK_FIELD',
                    radius * 1.5,
                    '#fff',
                    displayAsGhost
                );
            }
        }

        if (isSelected) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.stroke();

            if (
                launchMode &&
                entity.type === 'HUB' &&
                entity.owner === myPlayerId &&
                !displayAsGhost
            ) {
                ctx.save();
                ctx.setLineDash([8, 12]);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.lineWidth = 2;

                // Use toroidal distance for robust highlight detection
                const d = getToroidalDist(entity.x, entity.y, mousePos.x, mousePos.y, mapW, mapH);
                const ringHighlight = shouldHighlightRing(
                    d,
                    SLING_RING_RADIUS,
                    isAiming && entity.id === selectedHubId
                );

                if (ringHighlight) {
                    const isActive = isAiming && entity.id === selectedHubId;
                    ctx.strokeStyle = isActive
                        ? 'rgba(255, 255, 255, 0.95)'
                        : 'rgba(255, 255, 255, 0.7)';
                    // shadow removed
                }

                ctx.beginPath();
                ctx.arc(entity.x, entity.y, SLING_RING_RADIUS, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();

                // Task 4: Draw North-offset ghosted icon of selected item
                if (selectedItemType && selectedItemType !== 'HUB') {
                    ctx.save();
                    ctx.globalAlpha = 0.5;
                    ctx.translate(entity.x, entity.y - 60);

                    // Draw simplified ghost of the structure
                    ctx.beginPath();
                    ctx.strokeStyle = '#fff';
                    ctx.setLineDash([2, 4]);
                    ctx.lineWidth = 1;

                    const iconSize = (ENTITY_STATS[selectedItemType]?.size || 15) * 0.8;

                    if (selectedItemType.includes('DEFENSE') || selectedItemType === 'SHIELD') {
                        ctx.strokeRect(-iconSize, -iconSize, iconSize * 2, iconSize * 2);
                    } else {
                        ctx.arc(0, 0, iconSize, 0, Math.PI * 2);
                        ctx.stroke();
                    }

                    // Label for the ghost
                    ctx.fillStyle = '#fff';
                    ctx.font = '8px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(selectedItemType, 0, iconSize + 10);

                    ctx.restore();
                }
            }
        }
        ctx.restore();

        // Draw label if not a projectile or beam
        const isTransEntity =
            entity.type === 'PROJECTILE' ||
            ENTITY_STATS[entity.itemType || entity.type]?.damageFull !== undefined ||
            entity.type === 'LASER_BEAM';
        if (!isTransEntity) {
            ctx.save();
            ctx.globalAlpha = displayAsGhost ? 0.3 : 0.8;
            ctx.fillStyle = '#fff';
            ctx.font = displayAsGhost ? 'italic 10px Arial' : '10px Arial';
            ctx.textAlign = 'center';
            const labelOffset = ENTITY_STATS[entity.itemType || entity.type]?.labelOffset || 35;
            ctx.fillText(
                displayAsGhost ? `Ghost ${entity.type}` : entity.type,
                entity.x,
                entity.y + labelOffset
            );
            ctx.restore();

            if (entity.fuel !== undefined && entity.owner === myPlayerId && !displayAsGhost) {
                const dotYOffset = entity.type === 'HUB' ? -15 : -10;
                const dotXOffset = entity.type === 'HUB' ? 18 : 12;
                for (let i = 0; i < entity.maxFuel; i++) {
                    ctx.beginPath();
                    const dotY = entity.y + dotYOffset + i * 8;
                    ctx.arc(entity.x + dotXOffset, dotY, 3, 0, Math.PI * 2);
                    ctx.fillStyle = i < entity.fuel ? '#2ecc71' : '#444';
                    ctx.fill();
                }
            }

            // Nuke Countdown logic moved to main rendering block
        }
    });

    // 6. DRAW AIMING OVERLAY & UI previews
    if (isAiming && selectedHubId) {
        const hub = visualEntities[selectedHubId];
        if (hub) {
            // Calculate shortest vector once for world-wrap aware aiming
            const { dx: shortestDx, dy: shortestDy } = getToroidalDistVector(
                hub.x,
                hub.y,
                mousePos.x,
                mousePos.y,
                mapW,
                mapH
            );

            let dx = shortestDx;
            let dy = shortestDy;
            let distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > maxPullDistance) {
                const angle = Math.atan2(dy, dx);
                dx = Math.cos(angle) * maxPullDistance;
                dy = Math.sin(angle) * maxPullDistance;
                distance = maxPullDistance;
            }
            const ratio = distance / maxPullDistance;
            const strengthColor = getStrengthColor(ratio);
            const launchAngle = Math.atan2(-dy, -dx);

            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(hub.x, hub.y);
            ctx.lineTo(hub.x + dx, hub.y + dy);
            ctx.stroke();
            ctx.setLineDash([]);

            const arrowLen = HUB_RADIUS * (1 + ratio * 0.5);
            const arrowX = hub.x + Math.cos(launchAngle) * arrowLen;
            const arrowY = hub.y + Math.sin(launchAngle) * arrowLen;

            ctx.strokeStyle = strengthColor;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(hub.x, hub.y);
            ctx.lineTo(arrowX, arrowY);
            ctx.stroke();

            ctx.save();
            ctx.translate(arrowX, arrowY);
            ctx.rotate(launchAngle);
            ctx.fillStyle = strengthColor;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-12, -7);
            ctx.lineTo(-12, 7);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // Calculate projected target for all previews (Safety, Debug, Weapon Range)
            let launchDistance = GameState.calculateLaunchDistance(distance);
            const stats = ENTITY_STATS[selectedItemType];
            if (stats?.minRange) {
                launchDistance = Math.max(stats.minRange, launchDistance);
            }
            const ldx = Math.cos(launchAngle) * launchDistance;
            const ldy = Math.sin(launchAngle) * launchDistance;
            const targetX = (hub.x + (ldx % mapW) + mapW) % mapW;
            const targetY = (hub.y + (ldy % mapH) + mapH) % mapH;

            // Slingshot Safety: Check for link angle separation from the same hub
            const isInvalidAngle = GameState.checkLinkAngleSeparation(
                selectedItemType,
                selectedHubId,
                targetX,
                targetY,
                currentGameState.links,
                committedActions,
                Object.values(visualEntities),
                currentGameState.map
            );

            if (isInvalidAngle) {
                ctx.save();
                ctx.fillStyle = '#ff3333';
                ctx.font = 'bold 12px "Courier New"';
                ctx.textAlign = 'left';

                // Random jitter/glitch for the text
                const glitchX = (Math.random() - 0.5) * 2;
                const glitchY = (Math.random() - 0.5) * 2;

                const labelX = hub.x + ENTITY_STATS.HUB.size + 15;
                const labelY = hub.y + 5;

                ctx.fillText('INVALID ANGLE', labelX + glitchX, labelY + glitchY);

                // Indicator dot at hub
                ctx.beginPath();
                ctx.arc(hub.x, hub.y, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            if (showDebugPreview) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.setLineDash([2, 5]);
                drawToroidalLine(ctx, hub.x, hub.y, targetX, targetY, mapW, mapH, ldx, ldy);
                ctx.setLineDash([]);

                const previewSize = stats?.size || 12;

                if (selectedItemType === 'CLUSTER_BOMB') {
                    const count = stats.subBombCount;
                    const totalSpread = stats.spreadDistance;
                    const step = totalSpread / (count - 1 || 1);

                    // Perpendicular unit vector
                    const px = -ldy / launchDistance;
                    const py = ldx / launchDistance;

                    for (let i = 0; i < count; i++) {
                        const offset = i * step - totalSpread / 2;
                        const subTargetX = (targetX + offset * px + mapW) % mapW;
                        const subTargetY = (targetY + offset * py + mapH) % mapH;

                        ctx.beginPath();
                        ctx.arc(subTargetX, subTargetY, previewSize, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                } else {
                    ctx.beginPath();
                    if (selectedItemType === 'HUB' || selectedItemType === 'NUKE') {
                        // Hexagon Preview
                        for (let i = 0; i < 6; i++) {
                            const a = (i * 2 * Math.PI) / 6;
                            ctx.lineTo(
                                targetX + previewSize * Math.cos(a),
                                targetY + previewSize * Math.sin(a)
                            );
                        }
                        ctx.closePath();
                    } else if (selectedItemType === 'EXTRACTOR') {
                        // Triangle Preview
                        ctx.moveTo(targetX, targetY - previewSize);
                        ctx.lineTo(targetX + previewSize, targetY + previewSize / 2);
                        ctx.lineTo(targetX - previewSize, targetY + previewSize / 2);
                        ctx.closePath();

                        // Capture Radius Preview
                        ctx.save();
                        ctx.strokeStyle = VISUAL_STATS.EXTRACTOR.captureRadiusColor;
                        ctx.setLineDash([5, 5]);
                        ctx.beginPath();
                        ctx.arc(
                            targetX,
                            targetY,
                            GLOBAL_STATS.RESOURCE_CAPTURE_RADIUS,
                            0,
                            Math.PI * 2
                        );
                        ctx.stroke();
                        ctx.restore();
                    } else if (
                        selectedItemType === 'SHIELD' ||
                        selectedItemType === 'LASER_POINT_DEFENSE' ||
                        selectedItemType === 'FLAK_DEFENSE'
                    ) {
                        // Square Preview
                        ctx.rect(
                            targetX - previewSize,
                            targetY - previewSize,
                            previewSize * 2,
                            previewSize * 2
                        );
                    } else {
                        // Default Circle for projectiles
                        ctx.arc(targetX, targetY, previewSize, 0, Math.PI * 2);
                    }
                    ctx.stroke();

                    // AOE Preview for explosive weapons (Nuke, Weapon, Super Bomb, OVERLOAD) or SHIELD
                    const explosionRadius =
                        stats?.radiusFull || stats?.detectionRadius || stats?.range;
                    if (explosionRadius) {
                        ctx.save();

                        const vStats = VISUAL_STATS[selectedItemType];
                        const previewColor =
                            selectedItemType === 'NUKE'
                                ? 'rgba(255, 0, 0, 0.7)'
                                : selectedItemType === 'RECLAIMER'
                                  ? 'rgba(0, 255, 255, 0.7)'
                                  : selectedItemType === 'SHIELD'
                                    ? 'rgba(0, 255, 255, 0.5)'
                                    : vStats?.color
                                      ? `${vStats.color}b3`
                                      : 'rgba(255, 255, 255, 0.5)';

                        // 1. Full Damage Inner Ring (Solid-ish) / Shield Barrier
                        ctx.strokeStyle = previewColor;
                        ctx.lineWidth =
                            selectedItemType === 'NUKE' ||
                            selectedItemType === 'RECLAIMER' ||
                            selectedItemType === 'OVERLOAD' ||
                            selectedItemType === 'SHIELD'
                                ? 3
                                : 2;
                        ctx.setLineDash([10, 5]);
                        ctx.beginPath();

                        // Boundary is always circular for Shield now
                        ctx.arc(targetX, targetY, explosionRadius, 0, Math.PI * 2);
                        ctx.stroke();

                        // Add subtle boundary preview for Shield
                        if (selectedItemType === 'SHIELD') {
                            // Just the boundary ring, no internal hexes for the preview
                        }
                        // 2. Splash Damage Outer Ring (Dashed/Subtle)
                        if (stats.radiusHalf && stats.radiusHalf > stats.radiusFull) {
                            ctx.strokeStyle =
                                selectedItemType === 'NUKE'
                                    ? 'rgba(255, 140, 0, 0.5)'
                                    : 'rgba(255, 255, 255, 0.3)';
                            ctx.lineWidth = 1.5;
                            ctx.setLineDash([5, 15]);
                            ctx.beginPath();
                            ctx.arc(targetX, targetY, stats.radiusHalf, 0, Math.PI * 2);
                            ctx.stroke();
                        }

                        ctx.restore();
                    }

                    // Napalm AOE Preview during aiming
                    if (selectedItemType === 'NAPALM') {
                        ctx.save();
                        const nStats = ENTITY_STATS.NAPALM_FIRE;
                        const { dx, dy } = getToroidalDistVector(
                            hub.x,
                            hub.y,
                            targetX,
                            targetY,
                            mapW,
                            mapH
                        );
                        const angle = Math.atan2(dy, dx);
                        const radius = nStats.width / 2;

                        ctx.translate(targetX, targetY);
                        ctx.rotate(angle);
                        ctx.strokeStyle = 'rgba(255, 140, 0, 0.6)';
                        ctx.lineWidth = 2;
                        ctx.setLineDash([5, 5]);

                        ctx.beginPath();
                        // Remember: TargetX is the TIP, so we draw BACKWARDS (negative length)
                        ctx.arc(0, 0, radius, -Math.PI / 2, Math.PI / 2);
                        ctx.lineTo(-nStats.length, radius);
                        ctx.arc(-nStats.length, 0, radius, Math.PI / 2, -Math.PI / 2);
                        ctx.closePath();
                        ctx.stroke();
                        ctx.restore();
                    }
                }
            }
        }
    }

    // Dynamic extraction end
}
