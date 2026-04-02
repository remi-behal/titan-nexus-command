/**
 * Rendering Helpers for Titan: Nexus Command
 * Handles toroidal-aware coordinate transformations and drawing math.
 */

export const wrapCoordinate = (val, max) => {
    return ((val % max) + max) % max;
};

/**
 * Calculates segments for a line on a toroidal map to ensure it takes the shortest path.
 * Returns an array of line segments [{x1, y1, x2, y2}, ...]
 */
export const getToroidalLineSegments = (p1, p2, mapW, mapH) => {
    let dx = p2.x - p1.x;
    let dy = p2.y - p1.y;

    // Shortest path logic
    if (Math.abs(dx) > mapW / 2) {
        dx = dx > 0 ? dx - mapW : dx + mapW;
    }
    if (Math.abs(dy) > mapH / 2) {
        dy = dy > 0 ? dy - mapH : dy + mapH;
    }

    const targetX = p1.x + dx;
    const targetY = p1.y + dy;

    const segments = [];

    // If no wrapping is needed for this specific path
    if (targetX >= 0 && targetX <= mapW && targetY >= 0 && targetY <= mapH) {
        segments.push({ x1: p1.x, y1: p1.y, x2: targetX, y2: targetY });
    } else {
        // Simple implementation: Just return the offset target for now.
        // In the canvas, we can draw to (p1.x + dx, p1.y + dy) and then re-draw 
        // shifted by mapW/mapH if we want full connectivity visuals.
        segments.push({ x1: p1.x, y1: p1.y, x2: targetX, y2: targetY });
    }

    return segments;
};

/**
 * Transforms world coordinates to screen coordinates based on camera and zoom.
 */
export const worldToScreen = (worldX, worldY, cameraOffset, zoom) => {
    return {
        x: (worldX - cameraOffset.x) * zoom,
        y: (worldY - cameraOffset.y) * zoom
    };
};
