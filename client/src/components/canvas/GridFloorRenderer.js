import { drawShape } from '../../utils/ShapeRenderer.js';

export function drawGridFloor(ctx, map, viewBounds, offsetOffsetX, offsetOffsetY) {
    const { viewL, viewR, viewT, viewB } = viewBounds;

    // Draw Lakes
    if (map.lakes) {
        map.lakes.forEach((lake) => {
            if (lake.x + offsetOffsetX + lake.radius < viewL || 
                lake.x + offsetOffsetX - lake.radius > viewR ||
                lake.y + offsetOffsetY + lake.radius < viewT || 
                lake.y + offsetOffsetY - lake.radius > viewB) return;

            const rotation = ((lake.x * 12.98 + lake.y * 78.23) % 360) * Math.PI / 180;
            drawShape(ctx, lake.x, lake.y, 'LAKE', lake.radius, '#1a3a5a', rotation, false);
        });
    }

    // Draw Mountains
    if (map.mountains) {
        map.mountains.forEach((mtn) => {
            if (mtn.x + offsetOffsetX + mtn.radius < viewL || 
                mtn.x + offsetOffsetX - mtn.radius > viewR ||
                mtn.y + offsetOffsetY + mtn.radius < viewT || 
                mtn.y + offsetOffsetY - mtn.radius > viewB) return;

            const rotation = ((mtn.x * 43.21 + mtn.y * 13.57) % 360) * Math.PI / 180;
            drawShape(ctx, mtn.x, mtn.y, 'MOUNTAIN', mtn.radius, '#3d3434', rotation, false);
        });
    }

    // Draw Craters
    if (map.craters) {
        map.craters.forEach((crater) => {
            if (crater.x + offsetOffsetX + crater.radius < viewL || 
                crater.x + offsetOffsetX - crater.radius > viewR ||
                crater.y + offsetOffsetY + crater.radius < viewT || 
                crater.y + offsetOffsetY - crater.radius > viewB) return;

            drawShape(ctx, crater.x, crater.y, 'CRATER', crater.radius, '#222', 0, false);
        });
    }
    
    // Draw Resources
    if (map.resources) {
        map.resources.forEach((res) => {
            if (res.x + offsetOffsetX + (res.radius || 8) < viewL || 
                res.x + offsetOffsetX - (res.radius || 8) > viewR ||
                res.y + offsetOffsetY + (res.radius || 8) < viewT || 
                res.y + offsetOffsetY - (res.radius || 8) > viewB) return;

            const isSuper = res.isSuper === true;
            drawShape(ctx, res.x, res.y, isSuper ? 'SUPER_RESOURCE_NODE' : 'RESOURCE_NODE', res.radius || 8, isSuper ? '#a020f0' : '#ffa500', 0, false);
        });
    }
}
