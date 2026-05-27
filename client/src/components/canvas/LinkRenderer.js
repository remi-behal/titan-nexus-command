import { getGhostColor } from '../../utils/RenderingHelpers.js';
import { VISUAL_STATS } from '../../constants/VisualStats.js';
import { GLOBAL_STATS } from '../../../../shared/constants/EntityStats.js';

export function drawLinks(ctx, gameState, visualEntities, visualLinks, isInVision, viewBounds, mapW, mapH, offsetOffsetX, offsetOffsetY) {
    const { viewL, viewT, viewR, viewB } = viewBounds;

    Object.values(visualLinks).forEach((link) => {
        const from = visualEntities[link.from];
        const to = visualEntities[link.to];
        if (!from || !to) return;

        const minX = Math.min(from.x, to.x) + offsetOffsetX;
        const maxX = Math.max(from.x, to.x) + offsetOffsetX;
        const minY = Math.min(from.y, to.y) + offsetOffsetY;
        const maxY = Math.max(from.y, to.y) + offsetOffsetY;
        if (maxX < viewL || minX > viewR || maxY < viewT || minY > viewB) return;

        const ownerId = link.owner || from.owner;
        const player = gameState.players[ownerId];
        const baseColor = player ? player.color : '#666';
        const ghostColor = getGhostColor(baseColor, VISUAL_STATS.FOG_OF_WAR.GHOST_SATURATION);

        let dx = link.intendedDx !== null && link.intendedDx !== undefined ? link.intendedDx : to.x - from.x;
        let dy = link.intendedDy !== null && link.intendedDy !== undefined ? link.intendedDy : to.y - from.y;
        
        if (link.intendedDx === null || link.intendedDx === undefined) {
            if (Math.abs(dx) > mapW / 2) dx = dx > 0 ? dx - mapW : dx + mapW;
            if (Math.abs(dy) > mapH / 2) dy = dy > 0 ? dy - mapH : dy + mapH;
        }

        const distance = Math.sqrt(dx * dx + dy * dy);
        const segmentLen = 20;
        const segmentCount = Math.max(1, Math.ceil(distance / segmentLen));

        for (let i = 0; i < segmentCount; i++) {
            const rStart = i / segmentCount;
            const rEnd = (i + 1) / segmentCount;

            const x1 = from.x + dx * rStart;
            const y1 = from.y + dy * rStart;
            const x2 = from.x + dx * rEnd;
            const y2 = from.y + dy * rEnd;

            const midX = (from.x + (((dx * (rStart + rEnd)) / 2) % mapW) + mapW) % mapW;
            const midY = (from.y + (((dy * (rStart + rEnd)) / 2) % mapH) + mapH) % mapH;

            const segmentInVision = isInVision(midX, midY);
            const isSegmentGhost = !segmentInVision || link.isGhost;

            ctx.save();
            ctx.strokeStyle = isSegmentGhost ? ghostColor : baseColor;
            ctx.lineWidth = isSegmentGhost ? 1 : 2;
            ctx.globalAlpha = isSegmentGhost ? 0.2 : 1.0;
            if (isSegmentGhost) ctx.setLineDash([4, 4]);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            // Link pulses
            if (!isSegmentGhost) {
                const pulse = (Date.now() / 150) % 20;
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 15]);
                ctx.lineDashOffset = -pulse;
                ctx.stroke();
            }

            // Directional link arrows
            if (!isSegmentGhost && rStart <= 0.5 && rEnd > 0.5) {
                const arrowX = (x1 + x2) / 2;
                const arrowY = (y1 + y2) / 2;
                const angle = Math.atan2(dy, dx) + Math.PI;
                const size = GLOBAL_STATS.LINK_ARROW_SIZE || 10;

                ctx.save();
                ctx.translate(arrowX, arrowY);
                ctx.rotate(angle);
                ctx.fillStyle = baseColor;
                ctx.beginPath();
                ctx.moveTo(-size, -size / 2);
                ctx.lineTo(0, 0);
                ctx.lineTo(-size, size / 2);
                ctx.fill();
                ctx.restore();
            }

            ctx.restore();
        }
    });
}
