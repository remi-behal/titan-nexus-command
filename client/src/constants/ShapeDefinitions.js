/**
 * ShapeDefinitions.js
 * 
 * Central repository for normalized coordinate maps (-1 to 1).
 * Used by ShapeRenderer to draw consistent vector graphics across the game.
 */

export const SHAPE_TYPES = {
    PATH: 'PATH',
    FIELD: 'FIELD',
    BURST: 'BURST'
};

export const SHAPES = {
    // --- PHYSICAL STRUCTURES (PATH) ---
    HUB: {
        type: SHAPE_TYPES.PATH,
        points: [[0,-1], [0.86,-0.5], [0.86,0.5], [0,1], [-0.86,0.5], [-0.86,-0.5]],
        layers: 2,
        bracing: true,
        closed: true
    },
    EXTRACTOR: {
        type: SHAPE_TYPES.PATH,
        points: [[0,-1], [1,0], [0,1], [-1,0]], // Diamond shape
        layers: 2,
        bracing: true,
        closed: true
    },
    TURRET: {
        type: SHAPE_TYPES.PATH,
        points: [[-0.5,-1], [0.5,-1], [1,0.5], [-1,0.5]], // Trapezoidal base
        layers: 2,
        closed: true
    },
    BARRIER: {
        type: SHAPE_TYPES.PATH,
        points: [[-1,-0.3], [1,-0.3], [1,0.3], [-1,0.3]], // Flat slab
        layers: 2,
        closed: true
    },
    RECLAIMER: {
        type: SHAPE_TYPES.PATH,
        points: [[-0.7,-0.7], [0.7,-0.7], [0.7,0.7], [-0.7,0.7]], // Square
        layers: 2,
        bracing: true,
        closed: true
    },
    RELAY: {
        type: SHAPE_TYPES.PATH,
        points: [[0,-1], [0.5,1], [-0.5,1]], // Triangle beacon
        layers: 2,
        closed: true
    },
    CLOAKING_FIELD: {
        type: SHAPE_TYPES.PATH,
        points: [[0,-1], [1,0], [0,1], [-1,0]], // Diamond (matching extractor style for now)
        layers: 2,
        closed: true
    },
    LASER_POINT_DEFENSE: {
        type: SHAPE_TYPES.PATH,
        points: [[-0.5,1], [0.5,1], [0.5,-0.2], [0,-1], [-0.5,-0.2]], // Pentagon/Turret
        layers: 2,
        closed: true
    },
    FLAK_DEFENSE: {
        type: SHAPE_TYPES.PATH,
        points: [[-0.6,1], [0.6,1], [0.6,-0.4], [0.3,-0.4], [0.3,-1], [-0.3,-1], [-0.3,-0.4], [-0.6,-0.4]], // T-Shape turret
        layers: 2,
        closed: true
    },

    // --- PROJECTILES (PATH) ---
    MISSILE: {
        type: SHAPE_TYPES.PATH,
        points: [[0, -1.2], [0.5, 0.8], [0, 0.4], [-0.5, 0.8]], // Sharp arrowhead
        layers: 1,
        closed: true
    },
    PROJECTILE_SMALL: {
        type: SHAPE_TYPES.PATH,
        points: [[0,-1], [0.5,0], [0,1], [-0.5,0]], // Narrow diamond
        layers: 1,
        closed: true
    },
    NUKE_FLYING: {
        type: SHAPE_TYPES.PATH,
        points: [[0,-1], [0.86,-0.5], [0.86,0.5], [0,1], [-0.86,0.5], [-0.86,-0.5]],
        layers: 1,
        closed: true,
        symbol: 'RADIATION'
    },

    // --- FIELDS (FIELD) ---
    SHIELD_DOME: {
        type: SHAPE_TYPES.FIELD,
        drawType: 'ARC',
        dash: [8, 4],
        showTicks: true,
        pulse: true
    },
    CLOAK_FIELD: {
        type: SHAPE_TYPES.FIELD,
        drawType: 'ARC',
        dash: [4, 12],
        pulse: false
    },
    VISION_CONE: {
        type: SHAPE_TYPES.FIELD,
        drawType: 'CONE',
        fillOpacity: 0.1
    },

    // --- EFFECTS (BURST) ---
    EXPLOSION: {
        type: SHAPE_TYPES.BURST,
        points: 12,
        jaggedness: 0.5
    },
    SPARK: {
        type: SHAPE_TYPES.BURST,
        points: 6,
        jaggedness: 0.8
    }
};
