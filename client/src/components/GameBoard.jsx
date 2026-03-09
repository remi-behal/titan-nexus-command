import React, { useRef, useEffect, useState } from 'react';
import { GameState } from '../../../shared/GameState.js';
import { ENTITY_STATS, GLOBAL_STATS } from '../../../shared/EntityStats.js';
import { VISUAL_STATS } from '../constants/VisualStats.js';
import { shouldHighlightRing } from '../utils/uiLogic.js';

/**
 * GameBoard Component
 *  
 * Takes the 'gameState' and renders it using HTML5 Canvas.
 * Implements client-side interpolation (Lerp) for smooth movement.
 */
const GameBoard = ({
    gameState,
    myPlayerId,
    selectedHubId,
    launchMode,
    isAiming,
    onAimStart,
    onAimUpdate,
    onAimEnd,
    onSelectHub,
    committedActions,
    showDebugPreview,
    maxPullDistance
}) => {
    const canvasRef = useRef(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const ZOOM_LEVEL = 2; // 50% zoom in


    const HUB_RADIUS = ENTITY_STATS.HUB.size;
    const SLING_RING_RADIUS = GLOBAL_STATS.SLING_RING_RADIUS;
    const RING_INTERACTION_BUFFER = GLOBAL_STATS.RING_INTERACTION_BUFFER;

    // visualEntities stores the smoothly-interpolated positions of all objects
    const visualEntities = useRef({});
    const visualLinks = useRef({});

    const getStrengthColor = (ratio) => {
        // Linear transition: Green (0,255,0) -> Orange (255,165,0) -> Red (255,0,0)
        let r, g = 0;
        const b = 0;
        if (ratio < 0.5) {
            // Green to Orange
            const segmentRatio = ratio * 2;
            r = Math.floor(255 * segmentRatio);
            g = Math.floor(255 - (90 * segmentRatio));
        } else {
            // Orange to Red
            const segmentRatio = (ratio - 0.5) * 2;
            r = 255;
            g = Math.floor(165 * (1 - segmentRatio));
        }
        return `rgb(${r}, ${g}, ${b})`;
    };

    /**
     * Helper to calculate shortest toroidal distance between two points.
     */
    const getToroidalDist = (x1, y1, x2, y2, w, h) => {
        let dx = Math.abs(x2 - x1);
        let dy = Math.abs(y2 - y1);
        if (dx > w / 2) dx = w - dx;
        if (dy > h / 2) dy = h - dy;
        return Math.sqrt(dx * dx + dy * dy);
    };

    /**
     * Helper to get the shortest vector (dx, dy) between two points on a torus.
     */
    const getToroidalDistVector = (x1, y1, x2, y2, w, h) => {
        let dx = x2 - x1;
        let dy = y2 - y1;
        if (dx > w / 2) dx -= w;
        if (dx < -w / 2) dx += w;
        if (dy > h / 2) dy -= h;
        if (dy < -h / 2) dy += h;
        return { dx, dy };
    };

    const drawToroidalLine = (ctx, x1, y1, x2, y2, width, height, forceDx = null, forceDy = null) => {
        const dx = forceDx !== null ? forceDx : (x2 - x1);
        const dy = forceDy !== null ? forceDy : (y2 - y1);

        // In a 3x3 tiled renderer, we only need to draw the line once per tile.
        // The tiling itself handles the wrapping representation.
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + dx, y1 + dy);
        ctx.stroke();
    };

    // --- Main Animation & Draw Loop ---
    useEffect(() => {
        let animationFrameId;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const mapW = gameState.map.width;
        const mapH = gameState.map.height;

        const updateAndDraw = () => {
            // 1. UPDATE VISUAL POSITIONS (Lerp) & GHOST LOGIC
            // LERP_FACTOR targets how fast we reach the server's state.
            const LERP_FACTOR = 0.3;

            // Define current vision circles for re-scouting check
            const currentVisionCircles = gameState.entities
                .filter(e => e.owner === myPlayerId)
                .map(e => ({
                    x: e.x,
                    y: e.y,
                    radius: ENTITY_STATS[e.itemType || e.type]?.vision || 0
                }))
                .filter(v => v.radius > 0);

            const isInVision = (x, y) => {
                if (!myPlayerId || myPlayerId === 'spectator') return true;

                // First check current circular vision for buildings
                if (currentVisionCircles.some(v => getToroidalDist(v.x, v.y, x, y, mapW, mapH) <= v.radius)) {
                    return true;
                }

                // Then check specialized cone vision for projectiles
                return gameState.entities.some(e => {
                    if (e.owner !== myPlayerId) return false;
                    const stats = ENTITY_STATS[e.itemType || e.type];
                    const radius = stats?.vision || 0;
                    if (radius <= 0) return false;
                    if (e.itemType !== 'HOMING_MISSILE') return false;

                    const d = getToroidalDist(e.x, e.y, x, y, mapW, mapH);
                    if (d > radius) return false;
                    if (d < 1) return true; // Always see self

                    const vec = getToroidalDistVector(e.x, e.y, x, y, mapW, mapH);
                    const angleToPoint = Math.atan2(vec.dy, vec.dx) * (180 / Math.PI);
                    let diff = angleToPoint - (e.currentAngle || 0);
                    while (diff > 180) diff -= 360;
                    while (diff < -180) diff += 360;
                    return Math.abs(diff) <= (stats?.searchCone || 60) / 2;
                });
            };

            const serverIds = new Set(gameState.entities.map(e => e.id));

            // Update existing entities and handle New ones
            gameState.entities.forEach(serverEnt => {
                if (!visualEntities.current[serverEnt.id]) {
                    visualEntities.current[serverEnt.id] = {
                        ...serverEnt,
                        isGhost: false,
                        lastSeen: Date.now(),
                        scouted: serverEnt.scouted // server should provide this
                    };
                } else {
                    const viz = visualEntities.current[serverEnt.id];
                    let dx = serverEnt.x - viz.x;
                    if (Math.abs(dx) > mapW / 2) dx = dx > 0 ? dx - mapW : dx + mapW;
                    viz.x = ((viz.x + dx * LERP_FACTOR % mapW) + mapW) % mapW;

                    let dy = serverEnt.y - viz.y;
                    if (Math.abs(dy) > mapH / 2) dy = dy > 0 ? dy - mapH : dy + mapH;
                    viz.y = ((viz.y + dy * LERP_FACTOR % mapH) + mapH) % mapH;

                    viz.type = serverEnt.type;
                    viz.owner = serverEnt.owner;
                    viz.hp = serverEnt.hp;
                    viz.fuel = serverEnt.fuel;
                    viz.energy = serverEnt.energy;
                    viz.deployed = serverEnt.deployed;
                    viz.itemType = serverEnt.itemType;
                    viz.currentAngle = serverEnt.currentAngle;
                    viz.searchMode = serverEnt.searchMode;
                    viz.lockFound = serverEnt.lockFound;
                    viz.isGhost = false;
                    viz.lastSeen = Date.now();
                    viz.scouted = viz.scouted || serverEnt.scouted; // Once scouted, always scouted for ghosting purposes
                }
            });

            // Handle Ghosts: entities in visualEntities NOT in serverIds
            Object.keys(visualEntities.current).forEach(id => {
                if (!serverIds.has(id)) {
                    const viz = visualEntities.current[id];

                    // If it's a transient effect/projectile OR if it was OUR structure, it disappears immediately
                    const TRANSIENT_TYPES = ['PROJECTILE', 'WEAPON', 'SUPER_BOMB', 'EXPLOSION', 'LASER_BEAM', 'LINK_COLLISION'];
                    if (TRANSIENT_TYPES.includes(viz.type) || viz.owner === myPlayerId) {
                        delete visualEntities.current[id];
                        return;
                    }

                    // For foreign structures, check if we SHOULD see it right now (Re-scouting)
                    const currentlyInVision = isInVision(viz.x, viz.y);

                    if (currentlyInVision) {
                        // We are looking right at it and the server says it's not there -> It's gone!
                        delete visualEntities.current[id];
                    } else if (viz.scouted) {
                        // We can't see its last known position, so keep it as a ghost
                        viz.isGhost = true;
                    } else {
                        // It was never properly scouted, just seen via link endpoint
                        delete visualEntities.current[id];
                    }
                }
            });

            // Handle Links Ghosts
            gameState.links.forEach(serverLink => {
                const linkId = `${serverLink.from}-${serverLink.to}`;
                if (!visualLinks.current[linkId]) {
                    visualLinks.current[linkId] = { ...serverLink, isGhost: false };
                } else {
                    visualLinks.current[linkId].isGhost = false;
                }
            });

            Object.keys(visualLinks.current).forEach(linkId => {
                const viz = visualLinks.current[linkId];
                const inServer = gameState.links.some(l => `${l.from}-${l.to}` === linkId);

                if (!inServer) {
                    // Check if either end of the link is currently in vision. 
                    // If an end is in vision but the link is not in the server state, the link is gone.
                    const from = visualEntities.current[viz.from];
                    const to = visualEntities.current[viz.to];

                    if (!from || !to) {
                        delete visualLinks.current[linkId];
                        return;
                    }

                    const fromVisible = isInVision(from.x, from.y);
                    const toVisible = isInVision(to.x, to.y);

                    if (fromVisible || toVisible) {
                        delete visualLinks.current[linkId];
                    } else {
                        viz.isGhost = true;
                    }
                }
            });

            // 2. CLEAR CANVAS
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // -----------------------------------------------------------------
            // 3x3 TILED RENDERING LOOP
            // This ensures objects near edges appear on the opposite side.
            // -----------------------------------------------------------------
            ctx.save();
            // Apply zoom and camera offset
            ctx.scale(ZOOM_LEVEL, ZOOM_LEVEL);
            ctx.translate(-cameraOffset.x, -cameraOffset.y);

            for (let offsetOffsetX = -mapW; offsetOffsetX <= mapW; offsetOffsetX += mapW) {
                for (let offsetOffsetY = -mapH; offsetOffsetY <= mapH; offsetOffsetY += mapH) {
                    ctx.save();
                    ctx.translate(offsetOffsetX, offsetOffsetY);

                    // 2a. DRAW LAKES
                    if (gameState.map.lakes) {
                        gameState.map.lakes.forEach(lake => {
                            ctx.save();
                            ctx.fillStyle = '#1a3a5a'; // Deep water blue
                            ctx.globalAlpha = 0.6;
                            ctx.beginPath();
                            ctx.arc(lake.x, lake.y, lake.radius, 0, Math.PI * 2);
                            ctx.fill();
                            // Subtle border
                            ctx.strokeStyle = '#2a5a8a';
                            ctx.lineWidth = 2;
                            ctx.stroke();
                            ctx.restore();
                        });
                    }

                    // 2a-2. DRAW MOUNTAINS
                    if (gameState.map.mountains) {
                        gameState.map.mountains.forEach(mtn => {
                            ctx.save();
                            // Base stone circle
                            ctx.fillStyle = '#3d3434'; // Dark stone
                            ctx.globalAlpha = 0.8;
                            ctx.beginPath();
                            ctx.arc(mtn.x, mtn.y, mtn.radius, 0, Math.PI * 2);
                            ctx.fill();

                            // Peak (inner circle for height suggestion)
                            ctx.fillStyle = '#5c5252'; // Lighter stone
                            ctx.beginPath();
                            ctx.arc(mtn.x, mtn.y, mtn.radius * 0.6, 0, Math.PI * 2);
                            ctx.fill();

                            // Subtle rocky border
                            ctx.strokeStyle = '#2d2525';
                            ctx.lineWidth = 3;
                            ctx.stroke();
                            ctx.restore();
                        });
                    }

                    // 2b. DRAW GRID (Inside tiling for toroidal continuity)
                    ctx.strokeStyle = '#222';
                    ctx.lineWidth = 1;
                    const gridSize = 100;
                    for (let x = 0; x < mapW; x += gridSize) {
                        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, mapH); ctx.stroke();
                    }
                    for (let y = 0; y < mapH; y += gridSize) {
                        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(mapW, y); ctx.stroke();
                    }

                    // 3. DRAW LINKS (Segmented for partial Fog of War)
                    Object.values(visualLinks.current).forEach(link => {
                        const from = visualEntities.current[link.from];
                        const to = visualEntities.current[link.to];
                        if (!from || !to) return;

                        const ownerId = link.owner || from.owner;
                        const player = gameState.players[ownerId];
                        const baseColor = player ? player.color : '#666';

                        // Calculate desaturated color for ghost segments (Bug 1 fix)
                        // We use a more robust regex to replace the saturation (%) in HSL colors.
                        let ghostColor = baseColor.startsWith('hsl')
                            ? baseColor.replace(/(\d+)%/, '10%')
                            : '#888';

                        // Determine path
                        let dx, dy;
                        if (link.intendedDx !== null && link.intendedDx !== undefined) {
                            dx = link.intendedDx;
                            dy = link.intendedDy;
                        } else {
                            dx = to.x - from.x;
                            dy = to.y - from.y;
                            if (Math.abs(dx) > mapW / 2) dx = dx > 0 ? dx - mapW : dx + mapW;
                            if (Math.abs(dy) > mapH / 2) dy = dy > 0 ? dy - mapH : dy + mapH;
                        }

                        const distance = Math.sqrt(dx * dx + dy * dy);
                        const segmentLen = 20;
                        const segmentCount = Math.max(1, Math.ceil(distance / segmentLen));

                        for (let i = 0; i < segmentCount; i++) {
                            const rStart = i / segmentCount;
                            const rEnd = (i + 1) / segmentCount;

                            const x1 = from.x + dx * rStart;
                            const y1 = from.y + dy * rStart;
                            const x2 = from.x + dx * rEnd;
                            const y2 = from.y + dy * rEnd;

                            // Sample middle of segment for visibility check
                            const midX = ((from.x + dx * (rStart + rEnd) / 2 % mapW) + mapW) % mapW;
                            const midY = ((from.y + dy * (rStart + rEnd) / 2 % mapH) + mapH) % mapH;

                            const segmentInVision = isInVision(midX, midY);

                            // A segment is a ghost if it's personally out of vision OR if the whole link is a ghost
                            const isSegmentGhost = !segmentInVision || link.isGhost;

                            ctx.save();
                            ctx.strokeStyle = isSegmentGhost ? ghostColor : baseColor;
                            ctx.lineWidth = isSegmentGhost ? 1 : (GLOBAL_STATS.LINK_WIDTH || 2);
                            ctx.globalAlpha = isSegmentGhost ? 0.2 : 0.6;
                            if (isSegmentGhost) ctx.setLineDash([4, 4]);

                            ctx.beginPath();
                            ctx.moveTo(x1, y1);
                            ctx.lineTo(x2, y2);
                            ctx.stroke();

                            // Draw directional arrow pointing back (only once per link at the overall midpoint)
                            // We check if this segment contains the midpoint (ratio 0.5)
                            if (!isSegmentGhost && rStart <= 0.5 && rEnd > 0.5) {
                                const arrowX = (x1 + x2) / 2;
                                const arrowY = (y1 + y2) / 2;
                                const angle = Math.atan2(dy, dx) + Math.PI; // Point BACK
                                const size = GLOBAL_STATS.LINK_ARROW_SIZE || 10;

                                ctx.save();
                                ctx.translate(arrowX, arrowY);
                                ctx.rotate(angle);
                                ctx.fillStyle = baseColor;
                                ctx.beginPath();
                                ctx.moveTo(-size, -size / 2);
                                ctx.lineTo(0, 0);
                                ctx.lineTo(-size, size / 2);
                                ctx.fill();
                                ctx.restore();
                            }

                            ctx.restore();
                        }
                    });

                    // 4. DRAW RESOURCES
                    gameState.map.resources.forEach(res => {
                        const isSuper = res.isSuper === true;

                        // Large Pulse Aura for Super Nodes
                        if (isSuper) {
                            const { AURA_PULSE_SPEED, AURA_PULSE_MAGNITUDE, AURA_RADIUS_SCALE, AURA_COLOR, AURA_DEFAULT_RADIUS } = VISUAL_STATS.SUPER_NODE;
                            const pulse = Math.sin(Date.now() / AURA_PULSE_SPEED) * AURA_PULSE_MAGNITUDE;
                            ctx.save();
                            ctx.beginPath();
                            ctx.arc(res.x, res.y, (res.radius * AURA_RADIUS_SCALE || AURA_DEFAULT_RADIUS) + pulse, 0, Math.PI * 2);
                            ctx.fillStyle = AURA_COLOR;
                            ctx.fill();
                            ctx.restore();
                        }

                        ctx.fillStyle = res.color || '#00ffcc';
                        ctx.beginPath();
                        ctx.arc(res.x, res.y, res.radius || 8, 0, Math.PI * 2);
                        ctx.fill();
                    });

                    // 5. DRAW ENTITIES
                    Object.values(visualEntities.current).forEach(entity => {
                        const player = gameState.players[entity.owner];
                        let color = player ? player.color : '#fff';

                        // Bug 2 fix: An entity should display as a "ghost" (desaturated) if it's 
                        // NOT in active vision, even if it's still in the server state (e.g. as a link endpoint).
                        const currentlyInVision = isInVision(entity.x, entity.y);
                        const displayAsGhost = entity.isGhost || !currentlyInVision;

                        if (displayAsGhost) {
                            // Desaturate the color for ghosts (Bug 1 fix)
                            if (color.startsWith('hsl')) {
                                color = color.replace(/(\d+)%/, '10%'); // Drop saturation to 10%
                            } else {
                                color = '#888'; // Fallback gray
                            }
                        }

                        const isSelected = entity.id === selectedHubId && !displayAsGhost;
                        const isUndeployed = entity.deployed === false;

                        // DRAWING GUARD: Only render the entity if it is scouted (active vision/owned) 
                        // or if it's a ghost (previously scouted).
                        // This prevents enemy hubs at link endpoints from being visible in the dark.
                        if (!entity.scouted && !entity.isGhost) return;

                        ctx.save();
                        ctx.fillStyle = color;
                        ctx.globalAlpha = displayAsGhost ? 0.4 : (isUndeployed ? 0.5 : 1.0);

                        if (isSelected) {
                            ctx.shadowBlur = 15;
                            ctx.shadowColor = isUndeployed ? '#aaa' : '#fff';
                        }

                        if (isUndeployed) {
                            ctx.setLineDash([2, 2]);
                            ctx.strokeStyle = '#fff';
                            ctx.lineWidth = 1;
                        }

                        const isProjectile = (entity.type === 'PROJECTILE') || (ENTITY_STATS[entity.itemType || entity.type]?.damageFull !== undefined);

                        if (isProjectile) {
                            ctx.save();
                            const itemType = entity.itemType || entity.type;
                            const stats = ENTITY_STATS[itemType];
                            const radius = stats?.size || GLOBAL_STATS.PROJECTILE_RADIUS;

                            // 1. Draw Search Beam (faint cone)
                            if (entity.searchMode) {
                                ctx.save();
                                ctx.globalAlpha = 0.15;
                                ctx.fillStyle = color;
                                const rad = ((entity.currentAngle || 0) * Math.PI) / 180;
                                const beamRange = stats?.homingRange || 400;
                                const halfCone = (stats?.searchCone || 60) * (Math.PI / 180) / 2;

                                ctx.beginPath();
                                ctx.moveTo(entity.x, entity.y);
                                ctx.arc(entity.x, entity.y, beamRange, rad - halfCone, rad + halfCone);
                                ctx.fill();
                                ctx.restore();
                            }

                            // 2. Draw Engine Flare (back of missile)
                            if (entity.searchMode || entity.lockFound) {
                                ctx.save();
                                const rad = ((entity.currentAngle || 0) * Math.PI) / 180;
                                const flareLen = entity.lockFound ? 25 : 15;
                                const flareColor = entity.lockFound ? '#ff4500' : '#ffa500'; // Red-orange if locked, orange if just searching

                                ctx.shadowBlur = 15;
                                ctx.shadowColor = flareColor;
                                ctx.beginPath();
                                ctx.moveTo(entity.x - Math.cos(rad) * radius, entity.y - Math.sin(rad) * radius);
                                ctx.lineTo(entity.x - Math.cos(rad) * (radius + flareLen), entity.y - Math.sin(rad) * (radius + flareLen));
                                ctx.strokeStyle = flareColor;
                                ctx.lineWidth = radius * 0.8;
                                ctx.lineCap = 'round';
                                ctx.stroke();
                                ctx.restore();
                            }

                            // 3. Draw Projectile Body
                            ctx.shadowBlur = 10;
                            ctx.shadowColor = color;
                            ctx.fillStyle = color;

                            if (itemType === 'HOMING_MISSILE') {
                                // Render as a bullet
                                const rad = ((entity.currentAngle || 0) * Math.PI) / 180;
                                ctx.translate(entity.x, entity.y);
                                ctx.rotate(rad);
                                ctx.beginPath();
                                // Ellipse/Bullet shape
                                ctx.ellipse(0, 0, radius * 1.5, radius * 0.8, 0, 0, Math.PI * 2);
                                ctx.fill();
                                // Nose tip highlight
                                ctx.fillStyle = '#fff';
                                ctx.globalAlpha = 0.5;
                                ctx.beginPath();
                                ctx.arc(radius * 0.5, 0, radius * 0.3, 0, Math.PI * 2);
                                ctx.fill();
                            } else {
                                ctx.beginPath();
                                ctx.arc(entity.x, entity.y, radius, 0, Math.PI * 2);
                                ctx.fill();
                            }
                            ctx.restore();
                        }
                        else if (entity.type === 'LASER_BEAM') {
                            // Draw Laser Beam
                            ctx.save();
                            ctx.beginPath();
                            ctx.moveTo(entity.x, entity.y);
                            ctx.lineTo(entity.targetX, entity.targetY);
                            ctx.strokeStyle = '#f0f'; // Magenta laser
                            ctx.lineWidth = GLOBAL_STATS.LASER_BEAM_WIDTH;
                            ctx.shadowBlur = 10;
                            ctx.shadowColor = '#f0f';
                            ctx.stroke();

                            // Add a glow effect
                            ctx.globalAlpha = 0.5;
                            ctx.lineWidth = 6;
                            ctx.stroke();
                            ctx.restore();
                        } else if (entity.type === 'EXPLOSION') {
                            ctx.save();
                            ctx.beginPath();
                            ctx.arc(entity.x, entity.y, 40, 0, Math.PI * 2);
                            ctx.fillStyle = '#ff6600';
                            ctx.shadowBlur = 20;
                            ctx.shadowColor = '#ff3300';
                            ctx.fill();
                            ctx.restore();
                        } else if (entity.type === 'LINK_COLLISION') {
                            ctx.save();
                            ctx.beginPath();
                            ctx.arc(entity.x, entity.y, 15, 0, Math.PI * 2);
                            ctx.fillStyle = '#fff';
                            ctx.shadowBlur = 15;
                            ctx.shadowColor = '#00ffff';
                            ctx.fill();
                            // Static spark lines
                            ctx.strokeStyle = '#00ffff';
                            ctx.lineWidth = 2;
                            for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
                                ctx.beginPath();
                                ctx.moveTo(entity.x, entity.y);
                                ctx.lineTo(entity.x + Math.cos(a) * 25, entity.y + Math.sin(a) * 25);
                                ctx.stroke();
                            }
                            ctx.restore();
                        } else {
                            ctx.beginPath();
                            const radius = ENTITY_STATS[entity.itemType || entity.type]?.size || 20;

                            if (entity.type === 'DEFENSE') {
                                // Draw Defense as a square/diamond (radius is half-width)
                                ctx.rect(entity.x - radius, entity.y - radius, radius * 2, radius * 2);
                            } else if (entity.type === 'EXTRACTOR') {
                                // Draw Extractor as a triangle
                                ctx.beginPath();
                                ctx.moveTo(entity.x, entity.y - radius);
                                ctx.lineTo(entity.x + radius, entity.y + radius / 2);
                                ctx.lineTo(entity.x - radius, entity.y + radius / 2);
                                ctx.closePath();
                            } else {
                                ctx.arc(entity.x, entity.y, radius, 0, Math.PI * 2);
                            }
                            ctx.fill();
                            if (isUndeployed) {
                                ctx.stroke();
                            }
                        }

                        if (isSelected) {
                            ctx.strokeStyle = '#fff';
                            ctx.lineWidth = 3;
                            ctx.stroke();

                            if (launchMode && entity.type === 'HUB' && entity.owner === myPlayerId && !displayAsGhost) {
                                ctx.save();
                                ctx.setLineDash([8, 12]);
                                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                                ctx.lineWidth = 2;

                                // Use toroidal distance for robust highlight detection
                                const d = getToroidalDist(entity.x, entity.y, mousePos.x, mousePos.y, mapW, mapH);
                                const ringHighlight = shouldHighlightRing(d, SLING_RING_RADIUS, isAiming && entity.id === selectedHubId);

                                if (ringHighlight) {
                                    const isActive = isAiming && entity.id === selectedHubId;
                                    ctx.strokeStyle = isActive ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.7)';
                                    ctx.shadowBlur = isActive ? 15 : 10;
                                    ctx.shadowColor = '#fff';
                                }

                                ctx.beginPath();
                                ctx.arc(entity.x, entity.y, SLING_RING_RADIUS, 0, Math.PI * 2);
                                ctx.stroke();
                                ctx.restore();
                            }
                        }
                        ctx.restore();

                        // Draw label if not a projectile or beam
                        const isTransEntity = (entity.type === 'PROJECTILE') || (ENTITY_STATS[entity.itemType || entity.type]?.damageFull !== undefined) || entity.type === 'LASER_BEAM';
                        if (!isTransEntity) {
                            ctx.save();
                            ctx.globalAlpha = displayAsGhost ? 0.3 : 0.8;
                            ctx.fillStyle = '#fff';
                            ctx.font = displayAsGhost ? 'italic 10px Arial' : '10px Arial';
                            ctx.textAlign = 'center';
                            const labelOffset = ENTITY_STATS[entity.itemType || entity.type]?.labelOffset || 35;
                            ctx.fillText(displayAsGhost ? `Ghost ${entity.type}` : entity.type, entity.x, entity.y + labelOffset);
                            ctx.restore();

                            if (entity.fuel !== undefined && entity.owner === myPlayerId && !displayAsGhost) {
                                const dotYOffset = entity.type === 'HUB' ? -15 : -10;
                                const dotXOffset = entity.type === 'HUB' ? 18 : 12;
                                for (let i = 0; i < entity.maxFuel; i++) {
                                    ctx.beginPath();
                                    const dotY = entity.y + dotYOffset + (i * 8);
                                    ctx.arc(entity.x + dotXOffset, dotY, 3, 0, Math.PI * 2);
                                    ctx.fillStyle = i < entity.fuel ? '#2ecc71' : '#444';
                                    ctx.fill();
                                }
                            }
                        }
                    });

                    // 6. DRAW AIMING OVERLAY & UI previews
                    if (isAiming && selectedHubId) {
                        const hub = visualEntities.current[selectedHubId];
                        if (hub) {
                            // Calculate shortest vector once for world-wrap aware aiming
                            const { dx: shortestDx, dy: shortestDy } = getToroidalDistVector(hub.x, hub.y, mousePos.x, mousePos.y, mapW, mapH);

                            let dx = shortestDx;
                            let dy = shortestDy;
                            let distance = Math.sqrt(dx * dx + dy * dy);
                            if (distance > maxPullDistance) {
                                const angle = Math.atan2(dy, dx);
                                dx = Math.cos(angle) * maxPullDistance;
                                dy = Math.sin(angle) * maxPullDistance;
                                distance = maxPullDistance;
                            }
                            const ratio = distance / maxPullDistance;
                            const strengthColor = getStrengthColor(ratio);
                            const launchAngle = Math.atan2(-dy, -dx);

                            ctx.setLineDash([5, 5]);
                            ctx.strokeStyle = '#fff';
                            ctx.beginPath();
                            ctx.moveTo(hub.x, hub.y);
                            ctx.lineTo(hub.x + dx, hub.y + dy);
                            ctx.stroke();
                            ctx.setLineDash([]);

                            const arrowLen = HUB_RADIUS * (1 + (ratio * 0.5));
                            const arrowX = hub.x + Math.cos(launchAngle) * arrowLen;
                            const arrowY = hub.y + Math.sin(launchAngle) * arrowLen;

                            ctx.strokeStyle = strengthColor;
                            ctx.lineWidth = 4;
                            ctx.beginPath();
                            ctx.moveTo(hub.x, hub.y);
                            ctx.lineTo(arrowX, arrowY);
                            ctx.stroke();

                            ctx.save();
                            ctx.translate(arrowX, arrowY);
                            ctx.rotate(launchAngle);
                            ctx.fillStyle = strengthColor;
                            ctx.beginPath();
                            ctx.moveTo(0, 0); ctx.lineTo(-12, -7); ctx.lineTo(-12, 7);
                            ctx.closePath();
                            ctx.fill();
                            ctx.restore();

                            if (showDebugPreview) {
                                const launchDistance = GameState.calculateLaunchDistance(distance);
                                const ldx = Math.cos(launchAngle) * launchDistance;
                                const ldy = Math.sin(launchAngle) * launchDistance;
                                const targetX = ((hub.x + ldx % mapW) + mapW) % mapW;
                                const targetY = ((hub.y + ldy % mapH) + mapH) % mapH;

                                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                                ctx.setLineDash([2, 5]);
                                drawToroidalLine(ctx, hub.x, hub.y, targetX, targetY, mapW, mapH, ldx, ldy);
                                ctx.setLineDash([]);
                                ctx.beginPath();
                                ctx.arc(targetX, targetY, 12, 0, Math.PI * 2);
                                ctx.stroke();
                            }
                        }
                    }

                    // committed actions preview
                    committedActions.forEach((action, index) => {
                        const hub = visualEntities.current[action.sourceId];
                        if (hub) {
                            const angleRad = (action.angle * Math.PI) / 180;
                            const ratio = action.distance / maxPullDistance;
                            const strengthColor = getStrengthColor(ratio);
                            const arrowLen = HUB_RADIUS * (1 + (ratio * 0.5));
                            const ax = hub.x + Math.cos(angleRad) * arrowLen;
                            const ay = hub.y + Math.sin(angleRad) * arrowLen;

                            ctx.strokeStyle = strengthColor;
                            ctx.lineWidth = 4;
                            ctx.globalAlpha = 0.6;
                            ctx.beginPath();
                            ctx.moveTo(hub.x, hub.y); ctx.lineTo(ax, ay);
                            ctx.stroke();
                            ctx.globalAlpha = 1.0;

                            ctx.fillStyle = strengthColor;
                            ctx.beginPath();
                            ctx.arc(ax + Math.cos(angleRad) * 15, ay + Math.sin(angleRad) * 15, 10, 0, Math.PI * 2);
                            ctx.fill();
                            ctx.fillStyle = '#fff';
                            ctx.font = 'bold 10px Arial';
                            ctx.textAlign = 'center';
                            ctx.fillText((index + 1).toString(), ax + Math.cos(angleRad) * 15, ay + Math.sin(angleRad) * 15 + 4);
                        }
                    });

                    ctx.restore();
                }
            }

            // -----------------------------------------------------------------
            // 7. FOG OF WAR OVERLAY
            // -----------------------------------------------------------------
            if (myPlayerId && myPlayerId !== 'spectator') {
                // To prevent destination-out from erasing our map entities,
                // we render the fog logic to a temporary offscreen canvas first.
                const fogCanvas = document.createElement('canvas');
                fogCanvas.width = canvas.width;
                fogCanvas.height = canvas.height;
                const fctx = fogCanvas.getContext('2d');

                // 1. Draw solid fog overlay
                fctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                fctx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);

                // 2. Punch holes
                fctx.globalCompositeOperation = 'destination-out';
                fctx.fillStyle = '#ffffff';

                // We must apply the same world-space transform to the fog context
                fctx.scale(ZOOM_LEVEL, ZOOM_LEVEL);
                fctx.translate(-cameraOffset.x, -cameraOffset.y);

                // Tiled loop ensures holes wrap correctly alongside the entities
                for (let ox = -mapW; ox <= mapW; ox += mapW) {
                    for (let oy = -mapH; oy <= mapH; oy += mapH) {
                        fctx.save();
                        fctx.translate(ox, oy);

                        gameState.entities.forEach(e => {
                            const stats = ENTITY_STATS[e.itemType || e.type];
                            const isOwnProjectile = stats?.damageFull !== undefined && e.owner === myPlayerId;
                            const isOwnEntity = e.owner === myPlayerId;

                            if (isOwnEntity || isOwnProjectile) {
                                const radius = stats?.vision || 0;
                                if (radius > 0) {
                                    const viz = visualEntities.current[e.id] || e;
                                    fctx.beginPath();

                                    if (e.itemType === 'HOMING_MISSILE') {
                                        const rad = ((viz.currentAngle || 0) * Math.PI) / 180;
                                        const halfCone = (stats.searchCone || 60) * (Math.PI / 180) / 2;
                                        fctx.moveTo(viz.x, viz.y);
                                        fctx.arc(viz.x, viz.y, radius, rad - halfCone, rad + halfCone);
                                    } else {
                                        fctx.arc(viz.x, viz.y, radius, 0, Math.PI * 2);
                                    }
                                    fctx.fill();
                                }
                            }
                        });
                        fctx.restore();
                    }
                }

                // 3. Draw the completed fog mask back onto the main canvas
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.globalCompositeOperation = 'source-over';
                ctx.drawImage(fogCanvas, 0, 0);
                ctx.restore();
            }

            ctx.restore();

            animationFrameId = requestAnimationFrame(updateAndDraw);
        };

        animationFrameId = requestAnimationFrame(updateAndDraw);
        return () => cancelAnimationFrame(animationFrameId);
    }, [gameState, launchMode, isAiming, selectedHubId, mousePos, committedActions, showDebugPreview, maxPullDistance, myPlayerId, cameraOffset]);

    // Helper: Calculate game coordinates from mouse event
    const getGameCoords = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const cw = canvas.width;
        const ch = canvas.height;
        const rw = rect.width;
        const rh = rect.height;
        const canvasRatio = cw / ch;
        const rectRatio = rw / rh;

        let scale, offsetX, offsetY;
        if (rectRatio > canvasRatio) {
            scale = ch / rh;
            offsetX = (rw - (cw / scale)) / 2;
            offsetY = 0;
        } else {
            scale = cw / rw;
            offsetX = 0;
            offsetY = (rh - (ch / scale)) / 2;
        }


        const x = (((e.clientX - rect.left) - offsetX) * scale) / ZOOM_LEVEL + cameraOffset.x;
        const y = (((e.clientY - rect.top) - offsetY) * scale) / ZOOM_LEVEL + cameraOffset.y;
        return {
            x: ((x % gameState.map.width) + gameState.map.width) % gameState.map.width,
            y: ((y % gameState.map.height) + gameState.map.height) % gameState.map.height
        };
    };

    // Effect: Global Mouse Listeners for Panning & Aiming
    useEffect(() => {
        const handleGlobalMouseMove = (e) => {
            // Always track mouse coordinates for hover effects
            const { x, y } = getGameCoords(e);
            setMousePos({ x, y });

            if (isAiming) {
                onAimUpdate(x, y);
            } else if (isPanning) {
                // Determine raw movement in screen pixels
                const dx = e.clientX - panStart.x;
                const dy = e.clientY - panStart.y;

                // Move camera (account for canvas scale)
                const canvas = canvasRef.current;
                const rect = canvas.getBoundingClientRect();
                const scale = canvas.width / rect.width;

                setCameraOffset(prev => ({
                    x: ((prev.x - (dx * scale / ZOOM_LEVEL) % gameState.map.width) + gameState.map.width) % gameState.map.width,
                    y: ((prev.y - (dy * scale / ZOOM_LEVEL) % gameState.map.height) + gameState.map.height) % gameState.map.height
                }));

                setPanStart({ x: e.clientX, y: e.clientY });
            }
        };

        const handleGlobalMouseUp = (e) => {
            if (isAiming) {
                const { x, y } = getGameCoords(e);
                onAimEnd(x, y);
            }
            setIsPanning(false);
        };

        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [isAiming, isPanning, panStart, gameState.map.width, gameState.map.height]);

    const handleMouseDown = (e) => {
        const { x, y } = getGameCoords(e);

        // 1. If launchMode is active, ONLY allow interaction with the Sling Ring
        if (launchMode && selectedHubId) {
            const currentHub = gameState.entities.find(e => e.id === selectedHubId);
            if (currentHub && currentHub.owner === myPlayerId) {
                const d = getToroidalDist(currentHub.x, currentHub.y, x, y, gameState.map.width, gameState.map.height);
                const isInsideRing = d < SLING_RING_RADIUS;

                if (isInsideRing) {
                    // Start aiming for the already selected hub
                    onAimStart(currentHub.id, x, y);
                    return;
                }
            }
            // In launchMode, ignore all other clicks (don't deselect or switch hubs)
            return;
        }

        // 2. Normal mode: Check for DIRECT click on any Hub (Selection)
        // Shortest path aware selection
        const clickedHub = gameState.entities.find(ent => {
            if (ent.type !== 'HUB') return false;
            const d = getToroidalDist(ent.x, ent.y, x, y, gameState.map.width, gameState.map.height);
            return d < HUB_RADIUS;
        });

        if (clickedHub && clickedHub.owner === myPlayerId) {
            onSelectHub(clickedHub.id);
            return;
        }

        // 3. Middle click or Left click on empty space starts pan
        if (e.button === 0 || e.button === 1) {
            setIsPanning(true);
            setPanStart({ x: e.clientX, y: e.clientY });
        }

        // 4. Clicked empty space or an enemy hub - deselect
        onSelectHub(null);
    };

    return (
        <div className="game-container" style={{ background: '#111', border: '1px solid #333', borderRadius: '8px', overflow: 'hidden' }}>
            <canvas
                ref={canvasRef}
                width={gameState.map.width}
                height={gameState.map.height}
                onMouseDown={handleMouseDown}
                style={{
                    display: 'block',
                    cursor: isAiming ? 'crosshair' : isPanning ? 'grabbing' : 'grab',
                    width: '100%',
                    maxHeight: '80vh',
                    objectFit: 'contain'
                }}
            />
        </div>
    );
};

export default GameBoard;
