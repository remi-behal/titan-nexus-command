/**
 * TorusMath.js
 *
 * Houses pure mathematical functions for calculations on a toroidal grid.
 * Decoupled from the GameState state machine so renderers and systems can share logic.
 */

import { GLOBAL_STATS } from '../constants/EntityStats.js';

/**
 * Non-linear power curve math.
 * Given a raw pull distance, returns the tactical launch distance.
 */
export function calculateLaunchDistance(
    pullDistance,
    maxPull = GLOBAL_STATS.MAX_PULL,
    powerExponent = GLOBAL_STATS.POWER_EXPONENT,
    maxLaunch = GLOBAL_STATS.MAX_LAUNCH
) {
    const clampedPull = Math.min(pullDistance, maxPull);
    const ratio = clampedPull / maxPull;
    // Exponential curve: precision at low power, high sensitivity at high power
    return Math.pow(ratio, powerExponent) * maxLaunch;
}

/**
 * Calculate launch angle in degrees given a dx, dy pull vector.
 * Note: The launch direction is OPPOSITE to the pull direction.
 */
export function calculateLaunchAngle(dx, dy) {
    if (isNaN(dx) || isNaN(dy) || (dx === 0 && dy === 0)) return 0;
    // We pull away from target, so launch is opposite (-dx, -dy)
    return Math.atan2(-dy, -dx) * (180 / Math.PI);
}

/**
 * Helper to get the shortest distance vector (dx, dy) between two points on a torus.
 */
export function getToroidalVector(
    x1,
    y1,
    x2,
    y2,
    w = GLOBAL_STATS.MAP_WIDTH,
    h = GLOBAL_STATS.MAP_HEIGHT
) {
    if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return { dx: 0, dy: 0 };
    if (w <= 0 || h <= 0) return { dx: 0, dy: 0 };

    let dx = x2 - x1;
    let dy = y2 - y1;
    if (dx > w / 2) dx -= w;
    if (dx < -w / 2) dx += w;
    if (dy > h / 2) dy -= h;
    if (dy < -h / 2) dy += h;
    return { dx, dy };
}

/**
 * Checks if a line segment (x1, y1) -> (x2, y2) intersects a circle (cx, cy, radius).
 * Accounts for toroidal wrapping by normalizing relative to the circle center.
 */
export function lineCircleIntersection(
    x1,
    y1,
    x2,
    y2,
    cx,
    cy,
    radius,
    w = GLOBAL_STATS.MAP_WIDTH,
    h = GLOBAL_STATS.MAP_HEIGHT
) {
    // Step 1: Get vectors from circle center to segment endpoints
    const v1 = getToroidalVector(cx, cy, x1, y1, w, h);
    const v2 = getToroidalVector(cx, cy, x2, y2, w, h);

    // Coordinates relative to cx=0, cy=0
    const p1x = v1.dx;
    const p1y = v1.dy;
    const p2x = v2.dx;
    const p2y = v2.dy;

    const d_x = p2x - p1x;
    const d_y = p2y - p1y;

    const lensq = d_x * d_x + d_y * d_y;
    let t = 0;
    if (lensq > 0) {
        // Project origin (circle center) onto the line segment: t = dot(-P1, D) / |D|^2
        t = Math.max(0, Math.min(1, (-p1x * d_x + -p1y * d_y) / lensq));
    }

    const closestX = p1x + t * d_x;
    const closestY = p1y + t * d_y;
    const distSq = closestX * closestX + closestY * closestY;

    return distSq <= radius * radius;
}

/**
 * Map wrapping logic for Toroidal world
 */
export function wrapX(x, w = GLOBAL_STATS.MAP_WIDTH) {
    return ((x % w) + w) % w;
}

export function wrapY(y, h = GLOBAL_STATS.MAP_HEIGHT) {
    return ((y % h) + h) % h;
}

/**
 * Shortest distance between two points on a torus
 */
export function getToroidalDistance(
    x1,
    y1,
    x2,
    y2,
    w = GLOBAL_STATS.MAP_WIDTH,
    h = GLOBAL_STATS.MAP_HEIGHT
) {
    if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return 0;

    let dx = Math.abs(x2 - x1);
    let dy = Math.abs(y2 - y1);

    if (dx > w / 2) dx = w - dx;
    if (dy > h / 2) dy = h - dy;

    return Math.sqrt(dx * dx + dy * dy) || 0;
}

/**
 * Decomposes a toroidal link into 1, 2, or 4 Euclidean segments.
 */
export function getLinkSegments(p1, p2, w = GLOBAL_STATS.MAP_WIDTH, h = GLOBAL_STATS.MAP_HEIGHT) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    // Effective vector taking shortest toroidal path
    let edx = dx;
    if (Math.abs(dx) > w / 2) {
        edx = dx > 0 ? dx - w : dx + w;
    }

    let edy = dy;
    if (Math.abs(dy) > h / 2) {
        edy = dy > 0 ? dy - h : dy + h;
    }

    const segments = [];
    const wrapXFlag = Math.abs(dx) > w / 2;
    const wrapYFlag = Math.abs(dy) > h / 2;

    if (!wrapXFlag && !wrapYFlag) {
        segments.push({ p1: { ...p1 }, p2: { ...p2 } });
    } else {
        // Complex case: Break into segments at boundaries
        if (wrapXFlag && !wrapYFlag) {
            const xEdge = edx > 0 ? w : 0;
            const distToEdge = Math.abs(xEdge - p1.x);
            const t = distToEdge / Math.abs(edx);
            const yEdge = p1.y + edy * t;

            segments.push({ p1: { ...p1 }, p2: { x: xEdge, y: yEdge } });
            segments.push({ p1: { x: w - xEdge, y: yEdge }, p2: { ...p2 } });
        } else if (!wrapXFlag && wrapYFlag) {
            const yEdge = edy > 0 ? h : 0;
            const distToEdge = Math.abs(yEdge - p1.y);
            const t = distToEdge / Math.abs(edy);
            const xEdge = p1.x + edx * t;

            segments.push({ p1: { ...p1 }, p2: { x: xEdge, y: yEdge } });
            segments.push({ p1: { x: xEdge, y: h - yEdge }, p2: { ...p2 } });
        } else {
            // Double wrap (rare corner case) - simplified placeholder
            segments.push({ p1: { ...p1 }, p2: { ...p1 } });
        }
    }
    return segments;
}

/**
 * Point-to-Segment Distance Math (Toroidal Aware)
 * Returns the shortest physical distance from point (px, py) to line segment (x1, y1)-(x2, y2)
 */
export function getPointToSegmentDistance(
    px,
    py,
    x1,
    y1,
    x2,
    y2,
    w = GLOBAL_STATS.MAP_WIDTH,
    h = GLOBAL_STATS.MAP_HEIGHT
) {
    // Translate problem to be relative to (x1, y1) in a toroidal way
    let dx = x2 - x1;
    let dy = y2 - y1;
    if (Math.abs(dx) > w / 2) dx = dx > 0 ? dx - w : dx + w;
    if (Math.abs(dy) > h / 2) dy = dy > 0 ? dy - h : dy + h;

    let ppx = px - x1;
    let ppy = py - y1;
    if (Math.abs(ppx) > w / 2) ppx = ppx > 0 ? ppx - w : ppx + w;
    if (Math.abs(ppy) > h / 2) ppy = ppy > 0 ? ppy - h : ppy + h;

    const proj = getPointOnSegment(ppx, ppy, 0, 0, dx, dy);
    return Math.sqrt(Math.pow(ppx - proj.x, 2) + Math.pow(ppy - proj.y, 2));
}

/**
 * Point-to-Segment Math Helper
 * Returns the closest point on segment (x1, y1)-(x2, y2) to (px, py)
 */
export function getPointOnSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (dx === 0 && dy === 0) return { x: x1, y: y1 };

    const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
    if (t < 0) return { x: x1, y: y1 };
    if (t > 1) return { x: x2, y: y2 };

    return {
        x: x1 + t * dx,
        y: y1 + t * dy
    };
}
