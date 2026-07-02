export function drawUIOverlay(ctx, visualEntities, committedActions, maxPullDistance, HUB_RADIUS) {
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

    committedActions.forEach((action, index) => {
        const hub = visualEntities[action.sourceId];
        if (hub) {
            const angleRad = (action.angle * Math.PI) / 180;
            const ratio = action.distance / maxPullDistance;
            const strengthColor = getStrengthColor(ratio);
            const arrowLen = HUB_RADIUS * (1 + ratio * 0.5);
            const ax = hub.x + Math.cos(angleRad) * arrowLen;
            const ay = hub.y + Math.sin(angleRad) * arrowLen;

            ctx.strokeStyle = strengthColor;
            ctx.lineWidth = 4;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.moveTo(hub.x, hub.y);
            ctx.lineTo(ax, ay);
            ctx.stroke();
            ctx.globalAlpha = 1.0;

            ctx.fillStyle = strengthColor;
            ctx.beginPath();
            ctx.arc(ax + Math.cos(angleRad) * 15, ay + Math.sin(angleRad) * 15, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(
                (index + 1).toString(),
                ax + Math.cos(angleRad) * 15,
                ay + Math.sin(angleRad) * 15 + 4
            );
        }
    });
}
