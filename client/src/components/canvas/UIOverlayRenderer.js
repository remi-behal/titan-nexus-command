import { shouldHighlightRing } from '../../utils/uiLogic.js';
import { getGhostColor } from '../../utils/RenderingHelpers.js';

export function drawUIOverlays(ctx, props, state, getStrengthColor, getScreenCoords) {
    const {
        gameState,
        myPlayerId,
        selectedHubId,
        launchMode,
        isAiming,
        committedActions,
        mousePos,
        maxPullDistance
    } = props;

    const {
        activeHub,
        HUB_RADIUS,
        SLING_RING_RADIUS
    } = state;

    if (!gameState) return;

    const mapW = gameState.map.width;
    const mapH = gameState.map.height;

    // 1. Draw Ring Highlighter for aiming
    if (activeHub && !launchMode) {
        const ringHighlight = shouldHighlightRing(committedActions, activeHub.id);
        ctx.save();
        ctx.strokeStyle = ringHighlight ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)';
        ctx.lineWidth = ringHighlight ? 2 : 1;
        ctx.beginPath();
        ctx.arc(activeHub.x, activeHub.y, SLING_RING_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // 2. Draw Committed Actions
    committedActions.forEach((action, idx) => {
        const src = gameState.entities.find((e) => e.id === action.sourceId);
        if (!src) return;

        const player = gameState.players[myPlayerId];
        const baseColor = player ? player.color : '#fff';
        const angleRad = action.angle * Math.PI / 180;

        ctx.save();
        ctx.strokeStyle = baseColor;
        ctx.setLineDash([2, 4]);
        ctx.lineWidth = 1.5;

        // Dotted drag line
        const dragDist = action.distance * (maxPullDistance / 100);
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(src.x + dragDist * Math.cos(angleRad), src.y + dragDist * Math.sin(angleRad));
        ctx.stroke();

        // Release vector
        const powerRatio = action.distance / 100;
        const color = getStrengthColor(powerRatio);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.setLineDash([]);

        const arrowLen = 30 + powerRatio * 30;
        const launchX = src.x - arrowLen * Math.cos(angleRad);
        const launchY = src.y - arrowLen * Math.sin(angleRad);

        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(launchX, launchY);
        ctx.stroke();

        // Action tag label
        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.fillText(`#${idx + 1}`, launchX + 5, launchY - 5);
        ctx.restore();
    });

    // 3. Draw Live Slingshot pull
    if (isAiming && selectedHubId) {
        const src = gameState.entities.find((e) => e.id === selectedHubId);
        if (src) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(src.x, src.y, SLING_RING_RADIUS, 0, Math.PI * 2);
            ctx.stroke();

            // Calculate pull angle
            let dx = mousePos.x - src.x;
            let dy = mousePos.y - src.y;
            if (Math.abs(dx) > mapW / 2) dx = dx > 0 ? dx - mapW : dx + mapW;
            if (Math.abs(dy) > mapH / 2) dy = dy > 0 ? dy - mapH : dy + mapH;
            const angle = Math.atan2(dy, dx);
            const dist = Math.sqrt(dx * dx + dy * dy);
            const clampDist = Math.min(dist, maxPullDistance);

            // Pull dotted line
            ctx.strokeStyle = '#fff';
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(src.x, src.y);
            ctx.lineTo(src.x + clampDist * Math.cos(angle), src.y + clampDist * Math.sin(angle));
            ctx.stroke();

            // Launch vector power arrow
            const ratio = clampDist / maxPullDistance;
            const color = getStrengthColor(ratio);
            ctx.strokeStyle = color;
            ctx.lineWidth = 4;
            ctx.setLineDash([]);
            
            const launchX = src.x - (30 + ratio * 30) * Math.cos(angle);
            const launchY = src.y - (30 + ratio * 30) * Math.sin(angle);

            ctx.beginPath();
            ctx.moveTo(src.x, src.y);
            ctx.lineTo(launchX, launchY);
            ctx.stroke();
            ctx.restore();
        }
    }
}
