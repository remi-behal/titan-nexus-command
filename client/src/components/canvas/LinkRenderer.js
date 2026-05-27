import { getGhostColor } from '../../utils/RenderingHelpers.js';
import { VISUAL_STATS } from '../../constants/VisualStats.js';
import { GLOBAL_STATS } from '../../../../shared/constants/EntityStats.js';

export function drawLinks(ctx, visualLinks, visualEntities, players, viewBounds, mapW, mapH, offsetOffsetX, offsetOffsetY, isInVision) {
    const { viewL, viewR, viewT, viewB } = viewBounds;

    Object.values(visualLinks).forEach((link) => {
        const from = visualEntities[link.from];
        const to = visualEntities[link.to];
        if (!from || !to) return;

        // Link Culling: Check if link bounding box overlaps viewport
        const minX = Math.min(from.x, to.x) + offsetOffsetX;
        const maxX = Math.max(from.x, to.x) + offsetOffsetX;
        const minY = Math.min(from.y, to.y) + offsetOffsetY;
        const maxY = Math.max(from.y, to.y) + offsetOffsetY;
        if (maxX < viewL || minX > viewR || maxY < viewT || minY > viewB) return;

        const ownerId = link.owner || from.owner;
        const player = players[ownerId];
        const baseColor = player ? player.color : '#666';

        // Calculate desaturated color for ghost segments (Bug 1 fix)
        const ghostColor = getGhostColor(baseColor, VISUAL_STATS.FOG_OF_WAR.GHOST_SATURATION);

        // Determine path
        let dx, dy;
        if (link.intendedDx !== null && link.intendedDx !== undefined) {
            dx = link.intendedDx;
            dy = link.intendedDy;
        } else {
            dx = to.x - from.x;
            dy = to.y - from.y;
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

            // Sample middle of segment for visibility check
            const midX = (from.x + (((dx * (rStart + rEnd)) / 2) % mapW) + mapW) % mapW;
            const midY = (from.y + (((dy * (rStart + rEnd)) / 2) % mapH) + mapH) % mapH;

            const segmentInVision = isInVision(midX, midY);

            // A segment is a ghost if it's personally out of vision OR if the whole link is a ghost
            const isSegmentGhost = !segmentInVision || link.isGhost;

            ctx.save();
            ctx.strokeStyle = isSegmentGhost ? ghostColor : baseColor;
            ctx.lineWidth = isSegmentGhost ? 1 : 2;
            ctx.globalAlpha = isSegmentGhost ? 0.2 : 1.0;
            if (isSegmentGhost) ctx.setLineDash([4, 4]);

            // Base Cable
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            // Simple Pulse Dash
            if (!isSegmentGhost) {
                const pulse = (Date.now() / 150) % 20;
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 15]);
                ctx.lineDashOffset = -pulse;
                ctx.stroke();
            }

            // Draw directional arrow pointing back (only once per link at the overall midpoint)
            // We check if this segment contains the midpoint (ratio 0.5)
            if (!isSegmentGhost && rStart <= 0.5 && rEnd > 0.5) {
                const arrowX = (x1 + x2) / 2;
                const arrowY = (y1 + y2) / 2;
                const angle = Math.atan2(dy, dx) + Math.PI; // Point BACK
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
