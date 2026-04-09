export const VISUAL_STATS = {
    SUPER_NODE: {
        AURA_PULSE_SPEED: 200, // Divisor for Date.now()
        AURA_PULSE_MAGNITUDE: 5, // Max pixel expansion
        AURA_RADIUS_SCALE: 2, // Multiplier for base radius
        AURA_COLOR: 'rgba(191, 0, 255, 0.3)',
        AURA_DEFAULT_RADIUS: 20
    },
    OVERLOAD: {
        color: '#bf00ff', // Electric Purple
        secondaryColor: '#00ffff', // Cyan
        particleCount: 20
    },
    ECHO_ARTILLERY: {
        color: '#808080',
        secondaryColor: '#ff8c00'
    },
    SHIELD: {
        bubbleColor: 'rgba(0, 191, 255, 0.2)', // Deep Sky Blue
        strokeColor: 'rgba(0, 191, 255, 0.6)',
        impactColor: '#00ffff',
        color: 'rgba(0, 255, 255, 0.5)'
    },
    EMP: {
        color: '#00ffff', // Cyan
        secondaryColor: '#ffff00', // Yellow
        jitterMagnitude: 1,
        jitterFrequency: 500, // Update jitter every jitterFrequency ms
        flickerRate: 0.7 // Probability of showing a glitched color each frame
    },
    EXTRACTOR: {
        inactiveColor: '#555',
        activeColor: '#00ffff',
        captureRadiusColor: 'rgba(0, 255, 255, 0.4)',
        tetherColor: 'rgba(131, 255, 100, 1)'
    },
    FOG_OF_WAR: {
        GHOST_SATURATION: '35%',
        GHOST_TRANS_ALPHA: 0.4,
        GHOST_LINK_ALPHA: 0.2
    }
};
