import { drawShape } from '../../utils/ShapeRenderer.js';

export function drawGridFloor(ctx, gameState, myPlayerId, viewBounds, offsetOffsetX, offsetOffsetY) {
    const { lakes, mountains, craters, resources } = gameState.map;
    const { viewL, viewT, viewR, viewB } = viewBounds;

    // 1. Draw Lakes (Link-blocking obstacles)
    if (lakes) {
        lakes.forEach((lake) => {
            if (lake.x + offsetOffsetX + lake.radius < viewL || 
                lake.x + offsetOffsetX - lake.radius > viewR ||
                lake.y + offsetOffsetY + lake.radius < viewT || 
                lake.y + offsetOffsetY - lake.radius > viewB) return;

            const rotation = ((lake.x * 12.98 + lake.y * 78.23) % 360) * Math.PI / 180;
            drawShape(ctx, lake.x, lake.y, 'LAKE', lake.radius, '#1a3a5a', rotation, false);
        });
    }

    // 2. Draw Mountains (Buildable blocking, traversable links)
    if (mountains) {
        mountains.forEach((mtn) => {
            if (mtn.x + offsetOffsetX + mtn.radius < viewL || 
                mtn.x + offsetOffsetX - mtn.radius > viewR ||
                mtn.y + offsetOffsetY + mtn.radius < viewT || 
                mtn.y + offsetOffsetY - mtn.radius > viewB) return;

            const rotation = ((mtn.x * 43.21 + mtn.y * 13.57) % 360) * Math.PI / 180;
            drawShape(ctx, mtn.x, mtn.y, 'MOUNTAIN', mtn.radius, '#3d3434', rotation, false);
        });
    }

    // 3. Draw permanent scars (impact craters)
    if (craters) {
        craters.forEach((crater) => {
            if (crater.x + offsetOffsetX + crater.radius < viewL || 
                crater.x + offsetOffsetX - crater.radius > viewR ||
                crater.y + offsetOffsetY + crater.radius < viewT || 
                crater.y + offsetOffsetY - crater.radius > viewB) return;

            drawShape(ctx, crater.x, crater.y, 'CRATER', crater.radius, '#222', 0, false);
        });
    }

    // 4. Draw Energy Extraction Nodes
    if (resources) {
        resources.forEach((res) => {
            const rad = res.radius || 8;
            if (res.x + offsetOffsetX + rad < viewL || 
                res.x + offsetOffsetX - rad > viewR ||
                res.y + offsetOffsetY + rad < viewT || 
                res.y + offsetOffsetY - rad > viewB) return;

            const isSuper = res.isSuper === true;
            const shapeKey = isSuper ? 'SUPER_RESOURCE_NODE' : 'RESOURCE_NODE';
            const color = isSuper ? '#a020f0' : '#ffa500';

            drawShape(ctx, res.x, res.y, shapeKey, rad, color, 0, false);
        });
    }
}
