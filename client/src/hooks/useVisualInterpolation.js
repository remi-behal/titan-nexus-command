import { useRef } from 'react';
import { ENTITY_STATS } from '../../../shared/constants/EntityStats.js';
import * as TorusMath from '../../../shared/utils/TorusMath.js';
import { audioManager } from '../utils/AudioManager';

export function toroidalLerp(curr, target, maxDim, factor) {
    let delta = target - curr;
    if (Math.abs(delta) > maxDim / 2) {
        delta = delta > 0 ? delta - maxDim : delta + maxDim;
    }
    return (curr + (delta * factor) + maxDim) % maxDim;
}

export function useVisualInterpolation() {
    const visualEntities = useRef({});
    const visualLinks = useRef({});

    const updateInterpolation = (gameState, myPlayerId, LERP_FACTOR) => {
        if (!gameState) return { visualEntities: {}, visualLinks: {}, isInVision: () => true };

        const mapW = gameState.map.width;
        const mapH = gameState.map.height;

        // 1. Calculate active player vision circles
        const currentVisionCircles = gameState.entities
            .filter((e) => e.owner === myPlayerId && (ENTITY_STATS[e.itemType || e.type]?.vision || 0) > 0 && e.itemType !== 'HOMING_MISSILE')
            .map((e) => ({
                x: e.x,
                y: e.y,
                radius: ENTITY_STATS[e.itemType || e.type].vision
            }));

        const currentVisionCones = gameState.entities
            .filter((e) => e.owner === myPlayerId && e.itemType === 'HOMING_MISSILE')
            .map((e) => {
                const stats = ENTITY_STATS[e.itemType];
                return {
                    x: e.x,
                    y: e.y,
                    radius: stats.vision || 0,
                    angle: e.currentAngle || 0,
                    cone: stats.searchCone || 60
                };
            })
            .filter(c => c.radius > 0);

        const isInVision = (x, y) => {
            if (!myPlayerId || myPlayerId === 'spectator') return true;

            if (currentVisionCircles.some((v) => TorusMath.getToroidalDistance(v.x, v.y, x, y, mapW, mapH) <= v.radius)) {
                return true;
            }

            return currentVisionCones.some((c) => {
                const d = TorusMath.getToroidalDistance(c.x, c.y, x, y, mapW, mapH);
                if (d > c.radius) return false;
                if (d < 1) return true;

                const vec = TorusMath.getToroidalVector(c.x, c.y, x, y, mapW, mapH);
                const angleToPoint = Math.atan2(vec.dy, vec.dx) * (180 / Math.PI);
                let diff = angleToPoint - c.angle;
                while (diff > 180) diff -= 360;
                while (diff < -180) diff += 360;
                return Math.abs(diff) <= c.cone / 2;
            });
        };

        const serverIds = new Set(gameState.entities.map((e) => e.id));

        // Update / Add new entities with interpolation
        gameState.entities.forEach((serverEnt) => {
            if (!visualEntities.current[serverEnt.id]) {
                visualEntities.current[serverEnt.id] = {
                    ...serverEnt,
                    isGhost: false,
                    lastSeen: Date.now(),
                    scouted: serverEnt.scouted
                };

                // Play Audio
                if (serverEnt.type === 'PROJECTILE') {
                    if (serverEnt.itemType === 'HOMING_MISSILE') {
                        audioManager.playHeavyLaunch();
                    } else if (serverEnt.itemType === 'SAM_MISSILE' || serverEnt.itemType === 'SMART_SAM_MISSILE') {
                        audioManager.playSamLaunch();
                    } else {
                        audioManager.playShoot();
                    }
                } else if (serverEnt.type === 'LASER_BEAM') {
                    audioManager.playLaser();
                } else if (serverEnt.type === 'EXPLOSION') {
                    if (serverEnt.itemType === 'NUKE') {
                        audioManager.playNukeDetonation();
                    } else {
                        audioManager.playExplosion();
                    }
                } else if (serverEnt.type === 'SHIELD_HIT' || serverEnt.type === 'LINK_COLLISION' || serverEnt.type === 'SPARK') {
                    audioManager.playShieldHit();
                } else if (['HUB', 'EXTRACTOR', 'TURRET', 'SHIELD_GENERATOR', 'SHIELD', 'CLOAKING_FIELD', 'RELAY', 'BARRIER', 'WALL'].includes(serverEnt.type)) {
                    audioManager.playStructureLanding();
                }
            } else {
                const viz = visualEntities.current[serverEnt.id];
                if (serverEnt.hp < viz.hp) {
                    audioManager.playShieldHit();
                }

                viz.x = toroidalLerp(viz.x, serverEnt.x, mapW, LERP_FACTOR);
                viz.y = toroidalLerp(viz.y, serverEnt.y, mapH, LERP_FACTOR);

                viz.type = serverEnt.type;
                viz.owner = serverEnt.owner;
                viz.hp = serverEnt.hp;
                viz.fuel = serverEnt.fuel;
                viz.energy = serverEnt.energy;
                viz.deployed = serverEnt.deployed;
                viz.itemType = serverEnt.itemType;
                viz.currentAngle = serverEnt.currentAngle;
                viz.angle = serverEnt.angle;
                viz.searchMode = serverEnt.searchMode;
                const prevLockFound = viz.lockFound;
                viz.lockFound = serverEnt.lockFound;
                viz.flakActive = serverEnt.flakActive;
                
                if (viz.lockFound && !prevLockFound) {
                    if (['SAM_MISSILE', 'SMART_SAM_MISSILE', 'HOMING_MISSILE'].includes(serverEnt.itemType)) {
                        audioManager.playSamLockOn();
                    }
                }
                viz.flakAngle = serverEnt.flakAngle;
                viz.flakTriggerTick = serverEnt.flakTriggerTick;
                viz.barrierHp = serverEnt.barrierHp;
                viz.disabledUntilTurn = serverEnt.disabledUntilTurn;
                viz.detonationTurn = serverEnt.detonationTurn;
                viz.isCapturing = serverEnt.isCapturing;
                viz.capturedNodeId = serverEnt.capturedNodeId;
                viz.isGhost = false;
                viz.lastSeen = Date.now();
                viz.scouted = viz.scouted || serverEnt.scouted;
            }
        });

        // Resolve Ghosts
        Object.keys(visualEntities.current).forEach((id) => {
            if (!serverIds.has(id)) {
                const viz = visualEntities.current[id];
                const STRUCTURE_TYPES = ['HUB', 'EXTRACTOR', 'SHIELD', 'CLOAKING_FIELD', 'TURRET', 'RELAY', 'BARRIER'];
                if (STRUCTURE_TYPES.includes(viz.type)) {
                    if (viz.scouted !== false && !viz.isGhost) {
                        audioManager.playStructureDestroyed();
                    }
                }

                const TRANSIENT_TYPES = ['PROJECTILE', 'WEAPON', 'SUPER_BOMB', 'EXPLOSION', 'RECLAIM', 'LASER_BEAM', 'LINK_COLLISION', 'SPARK'];
                if (TRANSIENT_TYPES.includes(viz.type) || viz.owner === myPlayerId) {
                    delete visualEntities.current[id];
                    return;
                }

                if (isInVision(viz.x, viz.y)) {
                    delete visualEntities.current[id];
                } else if (viz.scouted) {
                    viz.isGhost = true;
                } else {
                    delete visualEntities.current[id];
                }
            }
        });

        // Update visual links and ghosts
        gameState.links.forEach((serverLink) => {
            const linkId = `${serverLink.from}-${serverLink.to}`;
            if (!visualLinks.current[linkId]) {
                visualLinks.current[linkId] = { ...serverLink, isGhost: false };
            } else {
                visualLinks.current[linkId].isGhost = false;
            }
        });

        Object.keys(visualLinks.current).forEach((linkId) => {
            const viz = visualLinks.current[linkId];
            const inServer = gameState.links.some((l) => `${l.from}-${l.to}` === linkId);

            if (!inServer) {
                const from = visualEntities.current[viz.from];
                const to = visualEntities.current[viz.to];

                if (!from || !to) {
                    delete visualLinks.current[linkId];
                    return;
                }

                const fromVisible = isInVision(from.x, from.y);
                const toVisible = isInVision(to.x, to.y);

                if (fromVisible || toVisible) {
                    if (!viz.isGhost) {
                        audioManager.playLinkSevered();
                    }
                    delete visualLinks.current[linkId];
                } else {
                    viz.isGhost = true;
                }
            }
        });

        return {
            visualEntities: visualEntities.current,
            visualLinks: visualLinks.current,
            isInVision
        };
    };

    return {
        updateInterpolation,
        visualEntities,
        visualLinks
    };
}
