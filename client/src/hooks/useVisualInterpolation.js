import { useRef } from 'react';
import { ENTITY_STATS } from '../../../shared/constants/EntityStats.js';
import * as TorusMath from '../../../shared/utils/TorusMath.js';
import { audioManager } from '../utils/AudioManager';

export function useVisualInterpolation() {
    const visualEntities = useRef({});
    const visualLinks = useRef({});
    const playedAudioEventIds = useRef(new Set());

    const updateInterpolation = (currentGameState, myPlayerId) => {
        if (!currentGameState) {
            return {
                visualEntities: visualEntities.current,
                visualLinks: visualLinks.current,
                isInVision: () => true
            };
        }

        // Reset tracking on game restart or turn planning phase 1
        if (currentGameState.turn === 1 && currentGameState.phase === 'PLANNING') {
            playedAudioEventIds.current.clear();
        }

        // Process Fog of War secure audio events
        if (currentGameState.audibleEvents) {
            currentGameState.audibleEvents.forEach((evt) => {
                if (!playedAudioEventIds.current.has(evt.id)) {
                    playedAudioEventIds.current.add(evt.id);
                    if (evt.type === 'PROJECTILE') {
                        if (evt.itemType === 'HOMING_MISSILE') {
                            audioManager.playHeavyLaunch(evt.x, evt.y);
                        } else if (evt.itemType === 'SAM_MISSILE' || evt.itemType === 'SMART_SAM_MISSILE') {
                            audioManager.playSamLaunch(evt.x, evt.y);
                        } else if (!['HUB', 'EXTRACTOR', 'TURRET', 'SHIELD_GENERATOR', 'SHIELD', 'CLOAKING_FIELD', 'RELAY', 'BARRIER', 'WALL'].includes(evt.itemType)) {
                            audioManager.playShoot(evt.x, evt.y);
                        }
                    } else if (evt.type === 'LASER_BEAM') {
                        audioManager.playLaser(evt.x, evt.y);
                    } else if (evt.type === 'EXPLOSION') {
                        if (evt.itemType === 'NUKE') {
                            audioManager.playNukeDetonation(evt.x, evt.y);
                        } else {
                            audioManager.playExplosion(evt.x, evt.y);
                        }
                    } else if (evt.type === 'SHIELD_HIT' || evt.type === 'LINK_COLLISION' || evt.type === 'SPARK') {
                        audioManager.playShieldHit(evt.x, evt.y);
                    } else if (evt.type === 'STRUCTURE_LANDING' || ['HUB', 'EXTRACTOR', 'TURRET', 'SHIELD_GENERATOR', 'SHIELD', 'CLOAKING_FIELD', 'RELAY', 'BARRIER', 'WALL'].includes(evt.type)) {
                        audioManager.playStructureLanding(evt.x, evt.y);
                    }
                }
            });
        }

        const mapW = currentGameState.map.width;
        const mapH = currentGameState.map.height;
        const LERP_FACTOR = 0.3;

        // 1a. Pre-calculate vision circles and cones for re-scouting/vision check
        const currentVisionCircles = currentGameState.entities
            .filter((e) => e.owner === myPlayerId && (ENTITY_STATS[e.itemType || e.type]?.vision || 0) > 0 && e.itemType !== 'HOMING_MISSILE')
            .map((e) => ({
                x: e.x,
                y: e.y,
                radius: ENTITY_STATS[e.itemType || e.type].vision
            }));

        const currentVisionCones = currentGameState.entities
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

        const serverIds = new Set(currentGameState.entities.map((e) => e.id));

        currentGameState.entities.forEach((serverEnt) => {
            if (!visualEntities.current[serverEnt.id]) {
                visualEntities.current[serverEnt.id] = {
                    ...serverEnt,
                    isGhost: false,
                    lastSeen: Date.now(),
                    scouted: serverEnt.scouted
                };

                // Play procedural SFX for newly spawned entities
                if (serverEnt.type === 'PROJECTILE') {
                    if (serverEnt.itemType === 'HOMING_MISSILE') {
                        audioManager.playHeavyLaunch(serverEnt.x, serverEnt.y);
                    } else if (serverEnt.itemType === 'SAM_MISSILE' || serverEnt.itemType === 'SMART_SAM_MISSILE') {
                        audioManager.playSamLaunch(serverEnt.x, serverEnt.y);
                    } else if (!['HUB', 'EXTRACTOR', 'TURRET', 'SHIELD_GENERATOR', 'SHIELD', 'CLOAKING_FIELD', 'RELAY', 'BARRIER', 'WALL'].includes(serverEnt.itemType)) {
                        audioManager.playShoot(serverEnt.x, serverEnt.y);
                    }
                } else if (serverEnt.type === 'LASER_BEAM') {
                    audioManager.playLaser(serverEnt.x, serverEnt.y);
                } else if (serverEnt.type === 'EXPLOSION') {
                    if (serverEnt.itemType === 'NUKE') {
                        audioManager.playNukeDetonation(serverEnt.x, serverEnt.y);
                    } else {
                        audioManager.playExplosion(serverEnt.x, serverEnt.y);
                    }
                } else if (serverEnt.type === 'SHIELD_HIT' || serverEnt.type === 'LINK_COLLISION' || serverEnt.type === 'SPARK') {
                    audioManager.playShieldHit(serverEnt.x, serverEnt.y);
                } else if (serverEnt.type === 'STRUCTURE_LANDING' || ['HUB', 'EXTRACTOR', 'TURRET', 'SHIELD_GENERATOR', 'SHIELD', 'CLOAKING_FIELD', 'RELAY', 'BARRIER', 'WALL'].includes(serverEnt.type)) {
                    audioManager.playStructureLanding(serverEnt.x, serverEnt.y);
                }
            } else {
                const viz = visualEntities.current[serverEnt.id];

                if (serverEnt.hp < viz.hp) {
                    audioManager.playShieldHit(serverEnt.x, serverEnt.y);
                }

                let dx = serverEnt.x - viz.x;
                if (Math.abs(dx) > mapW / 2) dx = dx > 0 ? dx - mapW : dx + mapW;
                viz.x = (viz.x + ((dx * LERP_FACTOR) % mapW) + mapW) % mapW;

                let dy = serverEnt.y - viz.y;
                if (Math.abs(dy) > mapH / 2) dy = dy > 0 ? dy - mapH : dy + mapH;
                viz.y = (viz.y + ((dy * LERP_FACTOR) % mapH) + mapH) % mapH;

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
                    if (serverEnt.itemType === 'SAM_MISSILE' || serverEnt.itemType === 'SMART_SAM_MISSILE' || serverEnt.itemType === 'HOMING_MISSILE') {
                        audioManager.playSamLockOn(serverEnt.x, serverEnt.y);
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

        // Handle Ghosts: entities in visualEntities NOT in serverIds
        Object.keys(visualEntities.current).forEach((id) => {
            if (!serverIds.has(id)) {
                const viz = visualEntities.current[id];
                const STRUCTURE_TYPES = ['HUB', 'EXTRACTOR', 'SHIELD', 'CLOAKING_FIELD', 'TURRET', 'RELAY', 'BARRIER'];
                
                if (STRUCTURE_TYPES.includes(viz.type)) {
                    if (viz.scouted !== false && !viz.isGhost) {
                        audioManager.playStructureDestroyed(viz.x, viz.y);
                    }
                }

                const TRANSIENT_TYPES = [
                    'PROJECTILE',
                    'WEAPON',
                    'SUPER_BOMB',
                    'EXPLOSION',
                    'RECLAIM',
                    'LASER_BEAM',
                    'LINK_COLLISION',
                    'SPARK'
                ];
                
                if (TRANSIENT_TYPES.includes(viz.type) || viz.owner === myPlayerId) {
                    delete visualEntities.current[id];
                    return;
                }

                const currentlyInVision = isInVision(viz.x, viz.y);

                if (currentlyInVision) {
                    delete visualEntities.current[id];
                } else if (viz.scouted) {
                    viz.isGhost = true;
                } else {
                    delete visualEntities.current[id];
                }
            }
        });

        // Handle Links Ghosts
        currentGameState.links.forEach((serverLink) => {
            const linkId = `${serverLink.from}-${serverLink.to}`;
            if (!visualLinks.current[linkId]) {
                visualLinks.current[linkId] = { ...serverLink, isGhost: false };
            } else {
                visualLinks.current[linkId].isGhost = false;
            }
        });

        Object.keys(visualLinks.current).forEach((linkId) => {
            const viz = visualLinks.current[linkId];
            const inServer = currentGameState.links.some((l) => `${l.from}-${l.to}` === linkId);

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
                        audioManager.playLinkSevered(from.x, from.y);
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
        visualEntities,
        visualLinks,
        updateInterpolation
    };
}
