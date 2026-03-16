/**
 * ExperimentalStats.js
 * 
 * Temporary definitions for items currently being tested.
 * To remove: Delete this file and its references in EntityStats.js.
 */

import { SPEED_TIERS } from './LaunchSpeeds.js';

export const EXPERIMENTAL_STATS = {
    SUPER_BOMB: {
        hp: 1,
        cost: 10,
        damageFull: 20,
        radiusFull: 10,
        damageHalf: 10,
        radiusHalf: 20,
        vision: 100,
        size: 15,           // Large projectile for visual distinction
        speed: SPEED_TIERS.VERY_FAST,           // VERY FAST (7 px/tick)
        deathEffect: 'DETONATE'
    }
};
