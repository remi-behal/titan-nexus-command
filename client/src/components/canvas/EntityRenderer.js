import { drawShape, drawField } from '../../utils/ShapeRenderer.js';
import { getGhostColor } from '../../utils/RenderingHelpers.js';
import { ENTITY_STATS } from '../../../../shared/constants/EntityStats.js';
import { VISUAL_STATS } from '../../constants/VisualStats.js';

export function drawEntities(ctx, gameState, visualEntities, myPlayerId, viewBounds, offsetOffsetX, offsetOffsetY) {
    const { viewL, viewT, viewR, viewB } = viewBounds;

    Object.values(visualEntities).forEach((entity) => {
        const stats = ENTITY_STATS[entity.itemType || entity.type];
        const size = stats?.size || entity.size || 20;

        if (entity.x + offsetOffsetX + size < viewL || 
            entity.x + offsetOffsetX - size > viewR ||
            entity.y + offsetOffsetY + size < viewT || 
            entity.y + offsetOffsetY - size > viewB) return;

        const player = gameState.players[entity.owner];
        const baseColor = player ? player.color : '#666';
        const color = entity.isGhost ? getGhostColor(baseColor, VISUAL_STATS.FOG_OF_WAR.GHOST_SATURATION) : baseColor;

        ctx.save();
        if (entity.isGhost) {
            ctx.globalAlpha = VISUAL_STATS.FOG_OF_WAR.GHOST_ALPHA;
        }

        // Draw Special Barriers
        if (entity.type === 'SHIELD' && entity.deployed) {
            const hasDomeFlicker = entity.hp <= 1;
            const shieldAlpha = hasDomeFlicker ? 0.04 + 0.15 * Math.sin(Date.now() / 60) : 0.2;
            drawField(ctx, entity.x, entity.y, stats.shieldRadius, color, shieldAlpha);
        } else if (entity.type === 'CLOAKING_FIELD' && entity.deployed) {
            drawField(ctx, entity.x, entity.y, stats.cloakRadius, 'rgba(128, 128, 128, 0.15)', 0.15);
        }

        // Base Structure Core
        const angle = entity.currentAngle !== undefined ? entity.currentAngle * Math.PI / 180 : (entity.angle || 0);
        drawShape(ctx, entity.x, entity.y, entity.itemType || entity.type, size, color, angle, entity.isGhost);

        // Health Overlay
        const maxHp = stats?.hp || 1;
        if (entity.hp !== undefined && entity.hp > 0 && maxHp > 1 && ['HUB', 'EXTRACTOR', 'SHIELD', 'CLOAKING_FIELD', 'TURRET', 'RELAY', 'BARRIER'].includes(entity.type)) {
            const hpWidth = size * 1.5;
            const hpHeight = 3;
            const hx = entity.x - hpWidth / 2;
            const hy = entity.y - size - 8;

            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(hx, hy, hpWidth, hpHeight);
            ctx.fillStyle = entity.isGhost ? '#888' : '#22c55e';
            ctx.fillRect(hx, hy, hpWidth * (entity.hp / maxHp), hpHeight);
        }

        // Fuel Overlay
        if (entity.fuel !== undefined && entity.owner === myPlayerId && !entity.isGhost && ['HUB', 'TURRET', 'SHIELD', 'CLOAKING_FIELD', 'RELAY'].includes(entity.type)) {
            const fuelWidth = size * 1.5;
            const fuelHeight = 2;
            const fx = entity.x - fuelWidth / 2;
            const fy = entity.y - size - 4;

            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(fx, fy, fuelWidth, fuelHeight);
            ctx.fillStyle = '#3b82f6';
            ctx.fillRect(fx, fy, fuelWidth * (entity.fuel / (stats.fuel || 1)), fuelHeight);
        }

        ctx.restore();
    });
}
