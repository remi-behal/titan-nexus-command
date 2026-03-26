/**
 * EntityStats.js
 * 
 * Centralized configuration for all entity stats in the game.
 * This includes HP, costs, fuel, range, and other balanced values.
 */

import { SPEED_TIERS } from './LaunchSpeeds.js';
import { EXPERIMENTAL_STATS } from './ExperimentalStats.js';

export const ENTITY_STATS = {
    ...EXPERIMENTAL_STATS,
    /** @see [structures.md#hubs](../../.agents/structures.md#hubs) */
    HUB: {
        hp: 5,
        fuel: 3,
        fuelRegen: 3,
        vision: 400,
        energyGen: 0,
        cost: 20,
        size: 40, // Base radius for rendering and selection
        labelOffset: 35,
        speed: SPEED_TIERS.SLOW,
        deathEffect: 'DISINTEGRATE'
    },
    /** @see [defenses.md#laser-point-defense](../../.agents/defenses.md#laser-point-defense) */
    LASER_POINT_DEFENSE: {
        hp: 2,
        fuel: 1,
        fuelRegen: 1,
        vision: 250,
        range: 100,
        cost: 25,
        size: 15, // Half-width for the square render
        labelOffset: 35,
        speed: SPEED_TIERS.SLOW,
        deathEffect: 'DISINTEGRATE'
    },
    /** @see [structures.md#extractors](../../.agents/structures.md#extractors) */
    EXTRACTOR: {
        hp: 2,
        vision: 200,
        energyGen: 5,
        cost: 25,
        size: 20,
        labelOffset: 35,
        speed: SPEED_TIERS.SLOW,
        deathEffect: 'DISINTEGRATE'
    },
    /** @see [weapons.md#dumb-bomb](../../.agents/weapons.md#dumb-bomb) */
    WEAPON: {
        hp: 1,
        cost: 15,
        damageFull: 2,
        radiusFull: 10,
        damageHalf: 1,
        radiusHalf: 20,
        vision: 100,
        size: 8, // Radius for the projectile render
        labelOffset: 35,
        speed: SPEED_TIERS.NORMAL,
        deathEffect: 'DETONATE'
    },
    /** @see [weapons.md#cluster-bomb](../../.agents/weapons.md#cluster-bomb) */
    CLUSTER_BOMB: {
        hp: 1,
        cost: 30,
        damageFull: 1,
        radiusFull: 30,
        damageHalf: 1,
        radiusHalf: 30,
        vision: 100,
        size: 8,
        speed: SPEED_TIERS.NORMAL,
        deathEffect: 'DETONATE',
        splitTickRatio: 0.6, // Splits at 60% of its travel time
        subBombCount: 3,
        spreadDistance: 200 // Total width of the perpendicular line
    },
    /** @see [weapons.md#homing-missile](../../.agents/weapons.md#homing-missile) */
    HOMING_MISSILE: {
        hp: 2,
        cost: 20,
        damageFull: 2,
        radiusFull: 10,
        damageHalf: 1,
        radiusHalf: 20,
        vision: 300,
        size: 8,
        speed: SPEED_TIERS.SLOW,
        maxSpeed: SPEED_TIERS.VERY_FAST,
        acceleration: 0.5,
        homingRange: 300,
        homingFuel: 400,
        searchCone: 60, //degrees
        turnRadius: 5,
        isSeeker: true,
        deathEffect: 'DETONATE'
    },
    /** @see [defenses.md#light-sam-defense](../../.agents/defenses.md#light-sam-defense) */
    LIGHT_SAM_DEFENSE: {
        hp: 2,
        fuel: 1,
        fuelRegen: 1,
        vision: 250,
        range: 200,
        cost: 25,
        size: 15,
        labelOffset: 35,
        speed: SPEED_TIERS.SLOW,
        deathEffect: 'DISINTEGRATE'
    },
    /** @see [defenses.md#sam-missile](../../.agents/defenses.md#sam-missile) */
    SAM_MISSILE: {
        hp: 1,
        cost: 0,
        damageFull: 2,
        radiusFull: 10,
        damageHalf: 1,
        radiusHalf: 20,
        vision: 0,
        size: 8,
        speed: SPEED_TIERS.INTERCEPTOR_INITIAL,
        maxSpeed: SPEED_TIERS.INTERCEPTOR_MAX,
        acceleration: 1,
        homingRange: 300,
        homingFuel: 400,
        searchCone: 360, // Full circle range for intercept
        turnRadius: 7.5,
        isInterceptor: true,
        isSeeker: true,
        deathEffect: 'DETONATE'
    },
    /** @see [defenses.md#flak-defense](../../.agents/defenses.md#flak-defense) */
    FLAK_DEFENSE: {
        hp: 2,
        fuel: 1,
        fuelRegen: 1,
        vision: 250,
        range: 150,
        cost: 25,
        size: 15,
        arc: 90,
        damage: 1,
        labelOffset: 35,
        speed: SPEED_TIERS.SLOW,
        deathEffect: 'DISINTEGRATE'
    },
    /** @see [weapons.md#nuke](../../.agents/weapons.md#nuke) */
    NUKE: {
        hp: 5,
        cost: 100,
        damageFull: 10,
        radiusFull: 200,
        damageHalf: 5,
        radiusHalf: 400,
        vision: 200,
        size: 25,
        speed: SPEED_TIERS.SLOW,
        landAsStructure: true,
        deathEffect: 'DISINTEGRATE' // Silent death if destroyed early
    },
    NAPALM: {
        hp: 1,
        cost: 35,
        vision: 100,
        size: 8,
        speed: SPEED_TIERS.NORMAL,
        minRange: 200,            // Bug 1: Prevent self-hits
        landAsStructure: false,   // Bug 2: Don't leave a shell entity
        deathEffect: 'DETONATE'
    },
    NAPALM_FIRE: {
        hp: 9999,
        duration: 2,
        damageTick: 1,
        length: 150,
        width: 30,
        isHazard: true,
        vision: 0
    },
    EXPLOSION_HAZARD: {
        radius: 200,
        damageTick: 1, // Damage taken by structures each round
        hp: 9999,      // Immune to accidental deletion
        isHazard: true,
        vision: 0
    },
    RECLAIMER: {
        hp: 1,
        cost: 0,
        vision: 100,
        size: 8,
        speed: SPEED_TIERS.NORMAL,
        radiusFull: 75,
        isInterceptable: false,
        onlyFriendly: true,
        landAsStructure: false,
        deathEffect: 'RECLAIM'
    },
    OVERLOAD: {
        hp: 1,
        cost: 40,
        vision: 100,
        size: 10,
        speed: SPEED_TIERS.NORMAL,
        detectionRadius: 30,
        isInterceptable: true,
        landAsStructure: false,
        deathEffect: 'DETONATE'
    },
    ECHO_ARTILLERY: {
        hp: 2,
        cost: 30,
        vision: 200,
        size: 20,
        detectionRange: 800,
        isInterceptable: false,
        accuracyDeviationAngle: 10, // ±5 degrees 
        accuracyDeviationDistance: 0.1 // ±5% distance
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

    // Simulation Parameters
    ACTION_SUB_TICKS: 200,
    SPEED_TIERS,

    // Visuals & UI
    RESOURCE_SIZE: 8,
    SLING_RING_RADIUS: 80,
    RING_INTERACTION_BUFFER: 15,
    PROJECTILE_RADIUS: 8,
    LASER_BEAM_WIDTH: 3,
    EXPLOSION_DURATION: 40,
    LASER_DURATION: 30
};
