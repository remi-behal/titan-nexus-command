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
        points: [[-1,-0.2], [-0.8,-0.4], [0.8,-0.4], [1,-0.2], [1,0.2], [0.8,0.4], [-0.8,0.4], [-1,0.2]], // Chamfered slab
        layers: 2,
        bracing: true,
        closed: true
    },
    RECLAIMER: {
        type: SHAPE_TYPES.PATH,
        points: [[-0.7,-0.7], [0.7,-0.7], [0.7,0.7], [-0.7,0.7]], // Square
        layers: 2,
        bracing: true,
        closed: true
    },

    MOUNTAIN: {
        type: SHAPE_TYPES.PATH,
        points: [[0,-1], [0.8,-0.5], [0.8,0.5], [0,1], [-0.8,0.5], [-0.8,-0.5]], // Jagged Hex base
        layers: 2,
        bracing: true,
        closed: true
    },

    SHIELD_HIT: {
        type: SHAPE_TYPES.PATH,
        points: [[0,-0.5], [0.2,-1], [0.4,-0.5], [1,0], [0.4,0.5], [0.2,1], [0,0.5], [-0.2,1], [-0.4,0.5], [-1,0], [-0.4,-0.5], [-0.2,-1]], // Spiky burst
        layers: 1,
        closed: true
    },
    NUKE_EXPLOSION: {
        type: SHAPE_TYPES.PATH,
        points: [[0,-1], [0.3,-0.7], [1,0], [0.3,0.7], [0,1], [-0.3,0.7], [-1,0], [-0.3,-0.7]], // Octagonal shockwave
        layers: 3,
        bracing: true,
        closed: true
    },
    NAPALM_LICK: {
        type: SHAPE_TYPES.PATH,
        points: [[0,-1], [0.2,-0.5], [0.4,0], [0.2,0.8], [0,1], [-0.2,0.8], [-0.4,0], [-0.2,-0.5]], // Flame lick
        layers: 1,
        closed: true
    },
    LAKE: {
        type: SHAPE_TYPES.PATH,
        points: [[-0.4, -1], [0.4, -1], [1, -0.4], [1, 0.4], [0.4, 1], [-0.4, 1], [-1, 0.4], [-1, -0.4]], // Octagon
        layers: 2,
        closed: true
    },
    RELAY: {
        type: SHAPE_TYPES.PATH,
        points: [[0,-1], [0.2,-0.4], [0.8,-0.2], [0.2,0], [0.5,1], [-0.5,1], [-0.2,0], [-0.8,-0.2], [-0.2,-0.4]], // Comms array
        layers: 2,
        bracing: true,
        closed: true
    },
    SHIELD: {
        type: SHAPE_TYPES.PATH,
        points: [[0,-1], [0.86,-0.5], [0.86,0.5], [0,1], [-0.86,0.5], [-0.86,-0.5]],
        layers: 2,
        symbol: 'CORE', // Specialized generator core
        closed: true
    },
    CLOAKING_FIELD: {
        type: SHAPE_TYPES.PATH,
        points: [[0, 1], [0.86, -0.5], [-0.86, -0.5]], // Inverted Triangle
        layers: 2,
        bracing: true,
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
    LIGHT_SAM_DEFENSE: {
        type: SHAPE_TYPES.PATH,
        points: [[-0.5,1], [0.5,1], [0.5,-1], [-0.5,-1]], // Vertical rectangular pod
        layers: 2,
        bracing: true,
        closed: true
    },
    SMART_SAM_DEFENSE: {
        type: SHAPE_TYPES.PATH,
        points: [[-0.7,1], [0.7,1], [0.7,0], [0.4,0], [0.4,-1], [-0.4,-1], [-0.4,0], [-0.7,0]], // Tiered launcher
        layers: 2,
        bracing: true,
        closed: true
    },
    RESOURCE_NODE: {
        type: SHAPE_TYPES.PATH,
        points: [[0,-1], [0.6,0], [0,1], [-0.6,0]], // Crystal diamond
        layers: 2,
        closed: true
    },
    SUPER_RESOURCE_NODE: {
        type: SHAPE_TYPES.PATH,
        points: [[0,-1], [0.5,-0.5], [1,0], [0.5,0.5], [0,1], [-0.5,0.5], [-1,0], [-0.5,-0.5]], // Large Octagon/Crystal
        layers: 3,
        bracing: true,
        closed: true
    },
    CRATER: {
        type: SHAPE_TYPES.PATH,
        points: [
            [1, 0], [0.92, 0.38], [0.71, 0.71], [0.38, 0.92],
            [0, 1], [-0.38, 0.92], [-0.71, 0.71], [-0.92, 0.38],
            [-1, 0], [-0.92, -0.38], [-0.71, -0.71], [-0.38, -0.92],
            [0, -1], [0.38, -0.92], [0.71, -0.71], [0.92, -0.38]
        ],
        layers: 1,
        closed: true
    },

    // --- PROJECTILES (PATH) ---
    MISSILE: {
        type: SHAPE_TYPES.PATH,
        // Finned Chevron
        points: [[0, -1.2], [0.4, 0], [0.6, 0.8], [0, 0.4], [-0.6, 0.8], [-0.4, 0]], 
        layers: 1,
        closed: true
    },
    CLUSTER_BOMB: {
        type: SHAPE_TYPES.PATH,
        points: [[-0.3,-1], [0.3,-1], [0.5,0], [0.3,1], [-0.3,1], [-0.5,0]], // Segmented capsule
        layers: 2,
        closed: true
    },
    CLUSTER_FRAGMENT: {
        type: SHAPE_TYPES.PATH,
        points: [[0,-0.8], [0,0.8], [0,0], [-0.8,0], [0.8,0]], // Simple cross (X)
        layers: 1,
        closed: false
    },
    PROJECTILE_SMALL: {
        type: SHAPE_TYPES.PATH,
        // Octagon
        points: [
            [0.38, -0.92], [0.92, -0.38], [0.92, 0.38], [0.38, 0.92],
            [-0.38, 0.92], [-0.92, 0.38], [-0.92, -0.38], [-0.38, -0.92]
        ],
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
    },
    ECHO_ARTILLERY: {
        type: SHAPE_TYPES.PATH,
        points: [[-0.4, 1], [0.4, 1], [0.6, 0.4], [0.2, 0], [0.8, -0.6], [0, -1], [-0.8, -0.6], [-0.2, 0], [-0.6, 0.4]],
        layers: 2,
        bracing: true,
        closed: true
    },
    WEAPON: {
        type: SHAPE_TYPES.PATH,
        points: [[0,-1], [0.4,-0.4], [0.4,0.4], [0.7,0.7], [0,0.4], [-0.7,0.7], [-0.4,0.4], [-0.4,-0.4]],
        layers: 1,
        closed: true
    },
    SAM_MISSILE: {
        type: SHAPE_TYPES.PATH,
        points: [[0,-1.2], [0.2,-0.4], [0.2,0.4], [0.5,0.8], [0,0.5], [-0.5,0.8], [-0.2,0.4], [-0.2,-0.4]],
        layers: 1,
        closed: true
    },
    SMART_SAM_MISSILE: {
        type: SHAPE_TYPES.PATH,
        points: [[0,-1.3], [0.15,-0.7], [0.3,-0.5], [0.15,-0.4], [0.15,0.4], [0.6,0.8], [0,0.5], [-0.6,0.8], [-0.15,0.4], [-0.15,-0.4], [-0.3,-0.5], [-0.15,-0.7]],
        layers: 1,
        closed: true
    },
    EMP: {
        type: SHAPE_TYPES.PATH,
        points: [[0,-1], [0.3,-0.6], [0.7,-0.7], [0.4,-0.2], [1,0], [0.4,0.2], [0.7,0.7], [0.3,0.6], [0,1], [-0.3,0.6], [-0.7,0.7], [-0.4,0.2], [-1,0], [-0.4,-0.2], [-0.7,-0.7], [-0.3,-0.6]],
        layers: 2,
        closed: true
    },
    OVERLOAD: {
        type: SHAPE_TYPES.PATH,
        points: [[0,-1.1], [0.96,0.55], [-0.96,0.55]],
        layers: 3,
        bracing: true,
        closed: true
    },
    NAPALM: {
        type: SHAPE_TYPES.PATH,
        points: [[0,-1], [0.4,-0.7], [0.4,0.7], [0.2,1], [-0.2,1], [-0.4,0.7], [-0.4,-0.7]],
        layers: 1,
        closed: true
    },
    SUPER_BOMB: {
        type: SHAPE_TYPES.PATH,
        points: [[0,-1], [0.5,-0.8], [0.5,-0.3], [1,-0.2], [0.5,0.2], [0.5,0.8], [0,1], [-0.5,0.8], [-0.5,0.2], [-1,-0.2], [-0.5,-0.3], [-0.5,-0.8]],
        layers: 2,
        bracing: true,
        closed: true
    }
};
