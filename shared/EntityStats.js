/**
 * EntityStats.js
 * 
 * Centralized configuration for all entity stats in the game.
 * This includes HP, costs, fuel, range, and other balanced values.
 */

export const ENTITY_STATS = {
    HUB: {
        hp: 5,
        fuel: 3,
        fuelRegen: 3,
        vision: 400,
        energyGen: 0,
        cost: 20,
        size: 40, // Base radius for rendering and selection
        labelOffset: 35
    },
    DEFENSE: {
        hp: 2,
        fuel: 1,
        fuelRegen: 1,
        vision: 250,
        range: 100,
        cost: 25,
        size: 15, // Half-width for the square render
        labelOffset: 35
    },
    EXTRACTOR: {
        hp: 2,
        vision: 200,
        energyGen: 5,
        cost: 25,
        size: 20,
        labelOffset: 35
    },
    WEAPON: {
        hp: 1,
        cost: 15,
        damageFull: 2,
        radiusFull: 10,
        damageHalf: 1,
        radiusHalf: 20,
        vision: 100,
        size: 8, // Radius for the projectile render
        labelOffset: 35
    }
};

export const RESOURCE_NODE_STATS = {
    STANDARD: {
        value: 5,
        radius: 8,
        color: '#00ffff'
    },
    SUPER: {
        value: 15,
        radius: 12,
        color: '#bf00ff',
        isSuper: true
    }
};

export const GLOBAL_STATS = {
    // Economy
    STARTING_ENERGY: 50,
    ENERGY_INCOME_PER_TURN: 10, // Switched to entity-based generation
    RESOURCE_CAPTURE_RADIUS: 30, // Distance to lock onto a node
    LINK_WIDTH: 5,               // Visual thickness of tethers
    LINK_ARROW_SIZE: 10,         // Size of direction indicator

    // Launch Physics
    MAX_PULL: 300,
    MAX_LAUNCH: 800,
    POWER_EXPONENT: 1.6,

    // Map & Structure Rules
    UNDEPLOYED_HP: 1,
    MAP_WIDTH: 2000,
    MAP_HEIGHT: 2000,
    DEFAULT_HP: 3,

    // Visuals & UI
    RESOURCE_SIZE: 8,
    SLING_RING_RADIUS: 80,
    RING_INTERACTION_BUFFER: 15,
    PROJECTILE_RADIUS: 8,
    LASER_BEAM_WIDTH: 3,
    EXPLOSION_DURATION: 20,
    LASER_DURATION: 15
};
