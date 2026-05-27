import { ENTITY_STATS } from '../../../../shared/constants/EntityStats.js';

export function drawFogOfWar(ctx, fogCanvasRef, canvasWidth, canvasHeight, zoom, cameraOffset, mapW, mapH, viewBounds, entities, visualEntities, myPlayerId) {
    if (!myPlayerId || myPlayerId === 'spectator') return;

    if (!fogCanvasRef.current) {
        fogCanvasRef.current = document.createElement('canvas');
    }
    const fogCanvas = fogCanvasRef.current;
    if (fogCanvas.width !== canvasWidth || fogCanvas.height !== canvasHeight) {
        fogCanvas.width = canvasWidth;
        fogCanvas.height = canvasHeight;
    }
    const fctx = fogCanvas.getContext('2d');

    // 1. Draw solid fog overlay
    fctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform to identity
    fctx.clearRect(0, 0, fogCanvas.width, fogCanvas.height);
    fctx.globalCompositeOperation = 'source-over';
    fctx.fillStyle = 'rgba(0, 0, 0, 1)';
    fctx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);

    // 2. Punch holes
    fctx.globalCompositeOperation = 'destination-out';
    fctx.fillStyle = '#ffffff';

    // We must apply the same world-space transform to the fog context
    fctx.scale(zoom, zoom);
    fctx.translate(-cameraOffset.x, -cameraOffset.y);

    const { viewL, viewR, viewT, viewB } = viewBounds;

    // Tiled loop ensures holes wrap correctly alongside the entities
    for (let ox = -mapW; ox <= mapW; ox += mapW) {
        for (let oy = -mapH; oy <= mapH; oy += mapH) {
            // TILE CULLING: Skip if this tile instance overlaps the viewport
            const tileL = ox;
            const tileT = oy;
            const tileR = ox + mapW;
            const tileB = oy + mapH;

            const pad = 800; // Account for large visual effects crossing tile boundaries
            const isTileVisible = !(tileR + pad < viewL || tileL - pad > viewR || tileB + pad < viewT || tileT - pad > viewB);
            if (!isTileVisible) continue;

            fctx.save();
            fctx.translate(ox, oy);

            // Punch holes for all owned entities
            entities.forEach((entity) => {
                // Culling: Skip if the VISION circle is outside the viewport
                const stats = ENTITY_STATS[entity.itemType || entity.type];
                const cullingRadius = Math.max(stats?.vision || 0, stats?.size || 20);
                if (entity.x + ox + cullingRadius < viewL || 
                    entity.x + ox - cullingRadius > viewR ||
                    entity.y + oy + cullingRadius < viewT || 
                    entity.y + oy - cullingRadius > viewB) return;

                const isOwnProjectile =
                    stats?.damageFull !== undefined && entity.owner === myPlayerId;
                const isOwnEntity = entity.owner === myPlayerId;

                if (isOwnEntity || isOwnProjectile) {
                    const radius = stats?.vision || 0;
                    if (radius > 0) {
                        const viz = visualEntities[entity.id] || entity;
                        fctx.beginPath();

                        if (entity.itemType === 'HOMING_MISSILE') {
                            const rad = ((viz.currentAngle || 0) * Math.PI) / 180;
                            const halfCone =
                                ((stats.searchCone || 60) * (Math.PI / 180)) / 2;
                            fctx.moveTo(viz.x, viz.y);
                            fctx.arc(
                                viz.x,
                                viz.y,
                                radius,
                                rad - halfCone,
                                rad + halfCone
                            );
                        } else {
                            fctx.arc(viz.x, viz.y, radius, 0, Math.PI * 2);
                        }
                        fctx.fill();
                    }
                }
            });
            fctx.restore();
        }
    }

    // 3. Draw the completed fog mask back onto the main canvas
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(fogCanvas, 0, 0);
    ctx.restore();
}
