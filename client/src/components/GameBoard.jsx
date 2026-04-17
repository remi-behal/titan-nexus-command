import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { GameState } from '../../../shared/GameState.js';
import { ENTITY_STATS, GLOBAL_STATS } from '../../../shared/constants/EntityStats.js';
import { VISUAL_STATS } from '../constants/VisualStats.js';
import { shouldHighlightRing } from '../utils/uiLogic.js';
import { getGhostColor } from '../utils/RenderingHelpers.js';

/**
 * GameBoard Component
 *
 * Takes the 'gameState' and renders it using HTML5 Canvas.
 * Implements client-side interpolation (Lerp) for smooth movement.
 */
// --- Toroidal Utility Helpers (Defined outside to avoid stale closures) ---
const getToroidalDist = (x1, y1, x2, y2, w, h) => {
    let dx = Math.abs(x2 - x1);
    let dy = Math.abs(y2 - y1);
    if (dx > w / 2) dx = w - dx;
    if (dy > h / 2) dy = h - dy;
    return Math.sqrt(dx * dx + dy * dy);
};

const getToroidalDistVector = (x1, y1, x2, y2, w, h) => {
    let dx = x2 - x1;
    let dy = y2 - y1;
    if (dx > w / 2) dx -= w;
    if (dx < -w / 2) dx += w;
    if (dy > h / 2) dy -= h;
    if (dy < -h / 2) dy += h;
    return { dx, dy };
};

const drawToroidalLine = (
    ctx,
    x1,
    y1,
    x2,
    y2,
    width,
    height,
    forceDx = null,
    forceDy = null
) => {
    const dx = forceDx !== null ? forceDx : x2 - x1;
    const dy = forceDy !== null ? forceDy : y2 - y1;

    // In a 3x3 tiled renderer, we only need to draw the line once per tile.
    // The tiling itself handles the wrapping representation.
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + dx, y1 + dy);
    ctx.stroke();
};

const GameBoard = forwardRef(({
    gameState,
    myPlayerId,
    selectedHubId,
    selectedItemType,
    launchMode,
    isAiming,
    onAimStart,
    onAimUpdate,
    onAimEnd,
    onSelectHub,
    committedActions,
    showDebugPreview,
    maxPullDistance,
    cameraOffset,
    setCameraOffset
}, ref) => {
    const canvasRef = useRef(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef({ x: 0, y: 0 });
    const mouseDownPosRef = useRef({ x: 0, y: 0 });
    const ZOOM_LEVEL = 2; // 50% zoom in

    const HUB_RADIUS = ENTITY_STATS.HUB.size;
    const SLING_RING_RADIUS = GLOBAL_STATS.SLING_RING_RADIUS;
    const RING_INTERACTION_BUFFER = GLOBAL_STATS.RING_INTERACTION_BUFFER;

    const visualEntities = useRef({});
    const visualLinks = useRef({});
    const fogCanvasRef = useRef(null); // Reuse for performance

    // Use a Ref to provide the animation loop with the latest props without restarting the loop
    const propsRef = useRef({
        gameState,
        myPlayerId,
        selectedHubId,
        selectedItemType,
        launchMode,
        isAiming,
        committedActions,
        mousePos,
        cameraOffset,
        maxPullDistance,
        showDebugPreview
    });

    useEffect(() => {
        propsRef.current = {
            gameState,
            myPlayerId,
            selectedHubId,
            selectedItemType,
            launchMode,
            isAiming,
            committedActions,
            mousePos,
            cameraOffset,
            maxPullDistance,
            showDebugPreview
        };
    }, [
        gameState,
        myPlayerId,
        selectedHubId,
        selectedItemType,
        launchMode,
        isAiming,
        committedActions,
        mousePos,
        cameraOffset,
        maxPullDistance,
        showDebugPreview
    ]);

    const getStrengthColor = (ratio) => {
        // Linear transition: Green (0,255,0) -> Orange (255,165,0) -> Red (255,0,0)
        let r,
            g = 0;
        const b = 0;
        if (ratio < 0.5) {
            // Green to Orange
            const segmentRatio = ratio * 2;
            r = Math.floor(255 * segmentRatio);
            g = Math.floor(255 - 90 * segmentRatio);
        } else {
            // Orange to Red
            const segmentRatio = (ratio - 0.5) * 2;
            r = 255;
            g = Math.floor(165 * (1 - segmentRatio));
        }
        return `rgb(${r}, ${g}, ${b})`;
    };

    // --- Main Animation & Draw Loop ---
    useEffect(() => {
        let animationFrameId;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const updateAndDraw = () => {
            try {
                const {
                    gameState: currentGameState,
                    myPlayerId,
                    selectedHubId,
                    selectedItemType,
                    launchMode,
                    isAiming,
                    committedActions,
                    mousePos,
                    cameraOffset: rawCameraOffset,
                    maxPullDistance,
                    showDebugPreview
                } = propsRef.current;

                // Defensive check for NaN camera offset
                const cameraOffset = {
                    x: isNaN(rawCameraOffset?.x) ? 0 : rawCameraOffset.x,
                    y: isNaN(rawCameraOffset?.y) ? 0 : rawCameraOffset.y
                };
                if (isNaN(rawCameraOffset?.x) || isNaN(rawCameraOffset?.y)) {
                    setCameraOffset({ x: 0, y: 0 });
                }

                if (!currentGameState) {
                    animationFrameId = requestAnimationFrame(updateAndDraw);
                    return;
                }

                const mapW = currentGameState.map.width;
                const mapH = currentGameState.map.height;

                // 1. UPDATE VISUAL POSITIONS (Lerp) & GHOST LOGIC
                // LERP_FACTOR targets how fast we reach the server's state.
                const LERP_FACTOR = 0.3;

                // Define current vision circles for re-scouting check
                const currentVisionCircles = currentGameState.entities
                    .filter((e) => e.owner === myPlayerId)
                    .map((e) => ({
                        x: e.x,
                        y: e.y,
                        radius: ENTITY_STATS[e.itemType || e.type]?.vision || 0
                    }))
                    .filter((v) => v.radius > 0);

                const isInVision = (x, y) => {
                    if (!myPlayerId || myPlayerId === 'spectator') return true;

                    // First check current circular vision for buildings
                    if (
                        currentVisionCircles.some(
                            (v) => getToroidalDist(v.x, v.y, x, y, mapW, mapH) <= v.radius
                        )
                    ) {
                        return true;
                    }

                    // Then check specialized cone vision for projectiles
                    return currentGameState.entities.some((e) => {
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

                const serverIds = new Set(currentGameState.entities.map((e) => e.id));

                // Update existing entities and handle New ones
                currentGameState.entities.forEach((serverEnt) => {
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
                        viz.searchMode = serverEnt.searchMode;
                        viz.lockFound = serverEnt.lockFound;
                        viz.flakActive = serverEnt.flakActive;
                        viz.flakAngle = serverEnt.flakAngle;
                        viz.flakTriggerTick = serverEnt.flakTriggerTick;
                        viz.barrierHp = serverEnt.barrierHp;
                        viz.disabledUntilTurn = serverEnt.disabledUntilTurn;
                        viz.detonationTurn = serverEnt.detonationTurn;
                        viz.isCapturing = serverEnt.isCapturing;
                        viz.capturedNodeId = serverEnt.capturedNodeId;
                        viz.isGhost = false;
                        viz.lastSeen = Date.now();
                        viz.scouted = viz.scouted || serverEnt.scouted; // Once scouted, always scouted for ghosting purposes
                    }
                });

                // Handle Ghosts: entities in visualEntities NOT in serverIds
                Object.keys(visualEntities.current).forEach((id) => {
                    if (!serverIds.has(id)) {
                        const viz = visualEntities.current[id];

                        // If it's a transient effect/projectile OR if it was OUR structure, it disappears immediately
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
                        if (currentGameState.map.lakes) {
                            currentGameState.map.lakes.forEach((lake) => {
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
                        if (currentGameState.map.mountains) {
                            currentGameState.map.mountains.forEach((mtn) => {
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

                        // 2-c. Craters (Permanent scars)
                        if (currentGameState.map.craters) {
                            currentGameState.map.craters.forEach((crater) => {
                                ctx.save();
                                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                                ctx.beginPath();
                                ctx.arc(crater.x, crater.y, crater.radius, 0, Math.PI * 2);
                                ctx.fill();
                                ctx.strokeStyle = '#222';
                                ctx.lineWidth = 4;
                                ctx.beginPath();
                                for (let i = 0; i < 16; i++) {
                                    const ang = (i / 16) * Math.PI * 2;
                                    const r = crater.radius * (0.85 + Math.sin(i * 1.3) * 0.1);
                                    ctx.lineTo(
                                        crater.x + Math.cos(ang) * r,
                                        crater.y + Math.sin(ang) * r
                                    );
                                }
                                ctx.closePath();
                                ctx.stroke();
                                ctx.restore();
                            });
                        }

                        // 2b. DRAW GRID (Inside tiling for toroidal continuity)
                        ctx.strokeStyle = '#222';
                        ctx.lineWidth = 1;
                        const gridSize = 100;
                        for (let x = 0; x < mapW; x += gridSize) {
                            ctx.beginPath();
                            ctx.moveTo(x, 0);
                            ctx.lineTo(x, mapH);
                            ctx.stroke();
                        }
                        for (let y = 0; y < mapH; y += gridSize) {
                            ctx.beginPath();
                            ctx.moveTo(0, y);
                            ctx.lineTo(mapW, y);
                            ctx.stroke();
                        }

                        // 3. DRAW LINKS (Segmented for partial Fog of War)
                        Object.values(visualLinks.current).forEach((link) => {
                            const from = visualEntities.current[link.from];
                            const to = visualEntities.current[link.to];
                            if (!from || !to) return;

                            const ownerId = link.owner || from.owner;
                            const player = currentGameState.players[ownerId];
                            const baseColor = player ? player.color : '#666';

                            // Calculate desaturated color for ghost segments (Bug 1 fix)
                            const ghostColor = getGhostColor(baseColor, VISUAL_STATS.FOG_OF_WAR.GHOST_SATURATION);

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
                                const midX =
                                    (from.x + (((dx * (rStart + rEnd)) / 2) % mapW) + mapW) % mapW;
                                const midY =
                                    (from.y + (((dy * (rStart + rEnd)) / 2) % mapH) + mapH) % mapH;

                                const segmentInVision = isInVision(midX, midY);

                                // A segment is a ghost if it's personally out of vision OR if the whole link is a ghost
                                const isSegmentGhost = !segmentInVision || link.isGhost;

                                ctx.save();
                                ctx.strokeStyle = isSegmentGhost ? ghostColor : baseColor;
                                ctx.lineWidth = isSegmentGhost ? 1 : GLOBAL_STATS.LINK_WIDTH || 2;
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
                        currentGameState.map.resources.forEach((res) => {
                            const isSuper = res.isSuper === true;

                            // Large Pulse Aura for Super Nodes
                            if (isSuper) {
                                const {
                                    AURA_PULSE_SPEED,
                                    AURA_PULSE_MAGNITUDE,
                                    AURA_RADIUS_SCALE,
                                    AURA_COLOR,
                                    AURA_DEFAULT_RADIUS
                                } = VISUAL_STATS.SUPER_NODE;
                                const pulse =
                                    Math.sin(Date.now() / AURA_PULSE_SPEED) * AURA_PULSE_MAGNITUDE;
                                ctx.save();
                                ctx.beginPath();
                                ctx.arc(
                                    res.x,
                                    res.y,
                                    (res.radius * AURA_RADIUS_SCALE || AURA_DEFAULT_RADIUS) + pulse,
                                    0,
                                    Math.PI * 2
                                );
                                ctx.fillStyle = AURA_COLOR;
                                ctx.fill();
                                ctx.restore();
                            }

                            ctx.fillStyle = res.color || '#00ffcc';
                            ctx.beginPath();
                            ctx.arc(res.x, res.y, res.radius || 8, 0, Math.PI * 2);
                            ctx.fill();
                        });

                        ctx.restore();
                    }
                }
                ctx.restore();

                // -----------------------------------------------------------------
                // 7. FOG OF WAR OVERLAY
                // -----------------------------------------------------------------
                if (myPlayerId && myPlayerId !== 'spectator') {
                    if (!fogCanvasRef.current) {
                        fogCanvasRef.current = document.createElement('canvas');
                    }
                    const fogCanvas = fogCanvasRef.current;
                    if (fogCanvas.width !== canvas.width || fogCanvas.height !== canvas.height) {
                        fogCanvas.width = canvas.width;
                        fogCanvas.height = canvas.height;
                    }
                    const fctx = fogCanvas.getContext('2d');

                    // 1. Draw solid fog overlay
                    fctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform to identity
                    fctx.clearRect(0, 0, fogCanvas.width, fogCanvas.height);
                    fctx.globalCompositeOperation = 'source-over';
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

                            currentGameState.entities.forEach((e) => {
                                const stats = ENTITY_STATS[e.itemType || e.type];
                                const isOwnProjectile =
                                    stats?.damageFull !== undefined && e.owner === myPlayerId;
                                const isOwnEntity = e.owner === myPlayerId;

                                if (isOwnEntity || isOwnProjectile) {
                                    const radius = stats?.vision || 0;
                                    if (radius > 0) {
                                        const viz = visualEntities.current[e.id] || e;
                                        fctx.beginPath();

                                        if (e.itemType === 'HOMING_MISSILE') {
                                            const rad = ((viz.currentAngle || 0) * Math.PI) / 180;
                                            const halfCone =
                                                ((stats.searchCone || 60) * (Math.PI / 180)) / 2;
                                            fctx.moveTo(viz.x, viz.y);
                                            fctx.arc(
                                                viz.x,
                                                viz.y,
                                                radius,
                                                rad - halfCone,
                                                rad + halfCone
                                            );
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

                // -----------------------------------------------------------------
                // 8. FOREGROUND & UI (Entities, Highlights, Aiming)
                // -----------------------------------------------------------------
                ctx.save(); // Balance with the final restore() at the end of updateAndDraw
                ctx.scale(ZOOM_LEVEL, ZOOM_LEVEL);
                ctx.translate(-cameraOffset.x, -cameraOffset.y);

                for (let offsetOffsetX = -mapW; offsetOffsetX <= mapW; offsetOffsetX += mapW) {
                    for (let offsetOffsetY = -mapH; offsetOffsetY <= mapH; offsetOffsetY += mapH) {
                        ctx.save();
                        ctx.translate(offsetOffsetX, offsetOffsetY);

                        // 5. DRAW ENTITIES
                        Object.values(visualEntities.current).forEach((entity) => {
                            const player = currentGameState.players[entity.owner];
                            let color = player ? player.color : '#fff';

                            const isDisabled = entity.disabledUntilTurn > currentGameState.turn;

                            // Bug 2 fix: An entity should display as a "ghost" (desaturated) if it's
                            // NOT in active vision, even if it's still in the server state (e.g. as a link endpoint).
                            const currentlyInVision = isInVision(entity.x, entity.y);
                            const displayAsGhost = entity.isGhost || !currentlyInVision;

                            if (displayAsGhost) {
                                // Desaturate the color for ghosts (Bug 1 fix)
                                color = getGhostColor(color, VISUAL_STATS.FOG_OF_WAR.GHOST_SATURATION);
                            }

                            const isSelected = entity.id === selectedHubId && !displayAsGhost;
                            const isUndeployed = entity.deployed === false;

                            // DRAWING GUARD: Only render the entity if it is scouted (active vision/owned)
                            // or if it's a ghost (previously scouted).
                            // This prevents enemy hubs at link endpoints from being visible in the dark.
                            if (entity.scouted === false && !entity.isGhost) return;

                            ctx.save();

                            // APPLY EMP JITTER (inside save/restore block to prevent cumulative drift)
                            if (isDisabled && !displayAsGhost) {
                                const eStats = VISUAL_STATS.EMP;
                                const tSeed = Math.floor(Date.now() / (eStats.jitterFrequency || 60));
                                const dx = Math.sin(tSeed * 12.98) * (eStats.jitterMagnitude || 2);
                                const dy = Math.cos(tSeed * 43.21) * (eStats.jitterMagnitude || 2);
                                ctx.translate(dx, dy);

                                if (Math.random() > (eStats.flickerRate || 0.7)) {
                                    color = Math.random() > 0.5 ? eStats.color : eStats.secondaryColor;
                                }
                            }

                            ctx.fillStyle = color;
                            ctx.globalAlpha = displayAsGhost ? 0.4 : isUndeployed ? 0.5 : 1.0;

                            if (isSelected) {
                                ctx.shadowBlur = 15;
                                ctx.shadowColor = isUndeployed ? '#aaa' : '#fff';
                            }

                            if (isUndeployed) {
                                ctx.setLineDash([2, 2]);
                                ctx.strokeStyle = '#fff';
                                ctx.lineWidth = 1;
                            }

                            const isProjectile =
                                entity.type === 'PROJECTILE' ||
                                entity.type === 'NAPALM' ||
                                (ENTITY_STATS[entity.itemType || entity.type]?.damageFull !==
                                    undefined &&
                                    (entity.type !== 'NUKE' || !entity.detonationTurn));
                            const stats = ENTITY_STATS[entity.itemType || entity.type];
                            const radius =
                                stats?.size || (isProjectile ? GLOBAL_STATS.PROJECTILE_RADIUS : 20);

                            if (isProjectile) {
                                ctx.save();

                                // 1. Draw Search Beam (faint cone)
                                if (entity.searchMode) {
                                    ctx.save();
                                    ctx.globalAlpha = 0.15;
                                    ctx.fillStyle = color;
                                    const rad = ((entity.currentAngle || 0) * Math.PI) / 180;
                                    const beamRange = stats?.homingRange || 400;
                                    const halfCone = ((stats?.searchCone || 60) * (Math.PI / 180)) / 2;

                                    ctx.beginPath();
                                    ctx.moveTo(entity.x, entity.y);
                                    ctx.arc(
                                        entity.x,
                                        entity.y,
                                        beamRange,
                                        rad - halfCone,
                                        rad + halfCone
                                    );
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
                                    ctx.moveTo(
                                        entity.x - Math.cos(rad) * radius,
                                        entity.y - Math.sin(rad) * radius
                                    );
                                    ctx.lineTo(
                                        entity.x - Math.cos(rad) * (radius + flareLen),
                                        entity.y - Math.sin(rad) * (radius + flareLen)
                                    );
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

                                if (entity.itemType === 'HOMING_MISSILE') {
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
                                } else if (entity.type === 'NUKE') {
                                    // Flying Nuke Icon (matching structure phase)
                                    ctx.save();
                                    ctx.translate(entity.x, entity.y);
                                    const pulse = 1 + Math.sin(Date.now() / 200) * 0.08;
                                    ctx.scale(pulse, pulse);
                                    ctx.beginPath();
                                    for (let i = 0; i < 6; i++) {
                                        const a = (i * 2 * Math.PI) / 6;
                                        ctx.lineTo(radius * Math.cos(a), radius * Math.sin(a));
                                    }
                                    ctx.closePath();
                                    ctx.fillStyle = '#f39c12';
                                    ctx.fill();
                                    // Simplified radiation symbol for small projectile
                                    ctx.fillStyle = '#000';
                                    ctx.globalAlpha = 0.6;
                                    ctx.beginPath();
                                    ctx.arc(0, 0, radius * 0.2, 0, Math.PI * 2);
                                    ctx.fill();
                                    ctx.restore();
                                } else {
                                    ctx.beginPath();
                                    ctx.arc(entity.x, entity.y, radius, 0, Math.PI * 2);
                                    ctx.fill();
                                }
                                ctx.restore();
                            } else if (entity.type === 'LASER_BEAM') {
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
                            } else if (entity.type === 'SPARK') {
                                ctx.save();
                                const sparkSize = 6 + Math.random() * 8; // Increased size
                                ctx.beginPath();
                                ctx.arc(entity.x, entity.y, sparkSize, 0, Math.PI * 2);
                                ctx.fillStyle = '#fff';
                                ctx.shadowBlur = 15;
                                ctx.shadowColor = '#ffff00';
                                ctx.fill();
                                ctx.restore();
                            } else if (entity.type === 'RECLAIM') {
                                ctx.save();
                                const radius = entity.radius || 75;
                                // Implosion effect: pulsing/shrinking concentric rings
                                const time = Date.now() / 200;
                                const shrink = 1 - (time % 1);

                                ctx.strokeStyle = '#00ffff';
                                ctx.lineWidth = 3;
                                ctx.setLineDash([10, 5]);
                                ctx.beginPath();
                                ctx.arc(entity.x, entity.y, radius * shrink, 0, Math.PI * 2);
                                ctx.stroke();

                                ctx.setLineDash([]);
                                ctx.globalAlpha = 0.3;
                                ctx.fillStyle = '#00cccc';
                                ctx.shadowBlur = 20;
                                ctx.shadowColor = '#00ffff';
                                ctx.beginPath();
                                ctx.arc(entity.x, entity.y, radius * (1 - shrink), 0, Math.PI * 2);
                                ctx.fill();
                                ctx.restore();
                            } else if (entity.type === 'EXPLOSION') {
                                ctx.save();
                                const explosionRadius = entity.radius || 40;
                                const vStats = VISUAL_STATS[entity.itemType];
                                ctx.strokeStyle = vStats?.color || '#ff9900';
                                ctx.lineWidth = 6;
                                ctx.beginPath();
                                ctx.arc(entity.x, entity.y, explosionRadius * 1.2, 0, Math.PI * 2);
                                ctx.stroke();
                                ctx.beginPath();
                                ctx.arc(entity.x, entity.y, explosionRadius, 0, Math.PI * 2);
                                ctx.fillStyle = vStats?.secondaryColor || '#ff6600';
                                ctx.shadowBlur = 20;
                                ctx.shadowColor = vStats?.color || '#ff3300';
                                ctx.fill();
                                ctx.restore();
                            } else if (entity.type === 'EXPLOSION_HAZARD') {
                                ctx.save();
                                const radius = entity.radius || 200;
                                const time = Date.now() / 1000;
                                const pulse = 1 + Math.sin(time * 5) * 0.05;
                                const grad = ctx.createRadialGradient(
                                    entity.x,
                                    entity.y,
                                    0,
                                    entity.x,
                                    entity.y,
                                    radius * pulse
                                );
                                grad.addColorStop(0, 'rgba(255, 69, 0, 0.6)');
                                grad.addColorStop(0.5, 'rgba(255, 140, 0, 0.3)');
                                grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                                ctx.fillStyle = grad;
                                ctx.beginPath();
                                ctx.arc(entity.x, entity.y, radius * pulse, 0, Math.PI * 2);
                                ctx.fill();
                                ctx.fillStyle = 'rgba(255, 255, 0, 0.1)';
                                for (let i = 0; i < 6; i++) {
                                    const angle = time + (i * Math.PI * 2) / 6;
                                    const r = radius * 0.5;
                                    ctx.beginPath();
                                    ctx.arc(
                                        entity.x + Math.cos(angle) * r,
                                        entity.y + Math.sin(angle) * r,
                                        radius * 0.4,
                                        0,
                                        Math.PI * 2
                                    );
                                    ctx.fill();
                                }
                                ctx.restore();
                            } else if (entity.type === 'NAPALM_FIRE') {
                                ctx.save();
                                const stats = ENTITY_STATS.NAPALM_FIRE;
                                const time = Date.now() / 1000;
                                const pulse = 1 + Math.sin(time * 10) * 0.03;
                                const width = stats.width * pulse;
                                const radius = width / 2;

                                // Calculate shortest toroidal vector to determine orientation
                                const { dx, dy } = getToroidalDistVector(
                                    entity.startX,
                                    entity.startY,
                                    entity.endX,
                                    entity.endY,
                                    mapW,
                                    mapH
                                );
                                const angle = Math.atan2(dy, dx);
                                const length = Math.sqrt(dx * dx + dy * dy);

                                ctx.translate(entity.startX, entity.startY);
                                ctx.rotate(angle);

                                // Draw the stadium (Capsule)
                                ctx.beginPath();
                                ctx.arc(0, 0, radius, Math.PI / 2, (3 * Math.PI) / 2);
                                ctx.lineTo(length, -radius);
                                ctx.arc(length, 0, radius, (3 * Math.PI) / 2, Math.PI / 2);
                                ctx.closePath();

                                const grad = ctx.createLinearGradient(0, 0, length, 0);
                                grad.addColorStop(0, 'rgba(255, 69, 0, 0.7)'); // Intense red-orange at tip
                                grad.addColorStop(1, 'rgba(255, 140, 0, 0.4)'); // Fades toward tail
                                ctx.fillStyle = grad;
                                ctx.shadowBlur = 15;
                                ctx.shadowColor = '#ff4500';
                                ctx.fill();

                                // Fire particles/licks inside
                                ctx.globalAlpha = 0.3;
                                ctx.fillStyle = '#ffaa00';
                                for (let i = 0; i < 5; i++) {
                                    const px = (Math.sin(time * 5 + i * 0.7) * 0.4 + 0.5) * length;
                                    const py = Math.cos(time * 3 + i * 1.1) * 0.2 * radius;
                                    ctx.beginPath();
                                    ctx.arc(px, py, radius * 0.4, 0, Math.PI * 2);
                                    ctx.fill();
                                }
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
                                    ctx.lineTo(
                                        entity.x + Math.cos(a) * 25,
                                        entity.y + Math.sin(a) * 25
                                    );
                                    ctx.stroke();
                                }
                                ctx.restore();
                            } else {
                                // Non-Projectile Entities (Structures, Hazards, etc.)
                                if (
                                    entity.type === 'LASER_POINT_DEFENSE' ||
                                    entity.type === 'FLAK_DEFENSE'
                                ) {
                                    ctx.beginPath();
                                    ctx.rect(
                                        entity.x - radius,
                                        entity.y - radius,
                                        radius * 2,
                                        radius * 2
                                    );
                                    ctx.fill();

                                    // --- Flak Defense Wall Visuals ---
                                    if (entity.type === 'FLAK_DEFENSE' && entity.flakActive) {
                                        ctx.save();
                                        const stats = ENTITY_STATS.FLAK_DEFENSE;
                                        const arcRange = stats.range;
                                        const arcWidth = (stats.arc * Math.PI) / 180;
                                        const centerAngle = (entity.flakAngle * Math.PI) / 180;

                                        // 1. Draw Sensor Cone (persistent faint arc)
                                        ctx.save();
                                        ctx.globalAlpha = 0.1;
                                        ctx.fillStyle = color;
                                        ctx.beginPath();
                                        ctx.moveTo(entity.x, entity.y);
                                        ctx.arc(
                                            entity.x,
                                            entity.y,
                                            arcRange,
                                            centerAngle - arcWidth / 2,
                                            centerAngle + arcWidth / 2
                                        );
                                        ctx.fill();
                                        ctx.restore();

                                        // 2. Draw multiple random small "explosions" in the arc
                                        ctx.save();
                                        ctx.globalAlpha = 0.4;
                                        const timeBucket = Math.floor(Date.now() / 83);
                                        const getSeededRandom = (seed) => {
                                            const x = Math.sin(seed) * 10000;
                                            return x - Math.floor(x);
                                        };
                                        let patternSeed =
                                            entity.id
                                                .split('')
                                                .reduce((acc, char) => acc + char.charCodeAt(0), 0) +
                                            timeBucket;

                                        for (let i = 0; i < 8; i++) {
                                            const r = getSeededRandom(patternSeed++) * arcRange;
                                            const theta =
                                                centerAngle +
                                                (getSeededRandom(patternSeed++) - 0.5) * arcWidth;
                                            const ex = entity.x + Math.cos(theta) * r;
                                            const ey = entity.y + Math.sin(theta) * r;
                                            const eSize = 4 + getSeededRandom(patternSeed++) * 8;

                                            ctx.beginPath();
                                            ctx.arc(ex, ey, eSize, 0, Math.PI * 2);
                                            const colorIdx = Math.floor(
                                                getSeededRandom(patternSeed++) * 3
                                            );
                                            ctx.fillStyle =
                                                colorIdx === 0
                                                    ? '#cc6655'
                                                    : colorIdx === 1
                                                        ? '#ccaa66'
                                                        : '#cccc77';
                                            ctx.shadowBlur = 5;
                                            ctx.shadowColor = '#884433';
                                            ctx.fill();
                                        }
                                        ctx.restore();
                                        ctx.restore();
                                    }
                                } else if (entity.type === 'HUB') {
                                    // Draw Hub as a solid Hexagon with a core
                                    ctx.save();
                                    ctx.translate(entity.x, entity.y);
                                    ctx.beginPath();
                                    for (let i = 0; i < 6; i++) {
                                        const a = (i * 2 * Math.PI) / 6;
                                        ctx.lineTo(radius * Math.cos(a), radius * Math.sin(a));
                                    }
                                    ctx.closePath();
                                    ctx.fill();

                                    // Bright White Core
                                    ctx.beginPath();
                                    ctx.arc(0, 0, radius * 0.45, 0, Math.PI * 2);
                                    ctx.fillStyle = '#fff';
                                    ctx.shadowBlur = 15;
                                    ctx.shadowColor = '#fff';
                                    ctx.fill();

                                    // Subtle inner ring for detail
                                    ctx.beginPath();
                                    ctx.arc(0, 0, radius * 0.25, 0, Math.PI * 2);
                                    ctx.fillStyle = color;
                                    ctx.globalAlpha = 0.6;
                                    ctx.fill();
                                    ctx.restore();
                                } else if (entity.type === 'EXTRACTOR') {
                                    // Draw Extractor as a triangle
                                    const isInactive = entity.deployed !== false && entity.isCapturing === false;

                                    if (isInactive) {
                                        ctx.fillStyle = VISUAL_STATS.EXTRACTOR.inactiveColor;
                                    }

                                    ctx.beginPath();
                                    ctx.moveTo(entity.x, entity.y - radius);
                                    ctx.lineTo(entity.x + radius, entity.y + radius / 2);
                                    ctx.lineTo(entity.x - radius, entity.y + radius / 2);
                                    ctx.closePath();
                                    ctx.fill();

                                    // Draw tether if capturing
                                    if (entity.isCapturing && entity.capturedNodeId) {
                                        const node = currentGameState.map.resources.find(r => r.id === entity.capturedNodeId);
                                        if (node) {
                                            ctx.save();
                                            ctx.strokeStyle = VISUAL_STATS.EXTRACTOR.tetherColor;
                                            ctx.lineWidth = 2;
                                            ctx.setLineDash([5, 5]);
                                            // Draw toroidal-aware tether
                                            const { dx, dy } = getToroidalDistVector(entity.x, entity.y, node.x, node.y, mapW, mapH);
                                            ctx.beginPath();
                                            ctx.moveTo(entity.x, entity.y);
                                            ctx.lineTo(entity.x + dx, entity.y + dy);
                                            ctx.stroke();
                                            ctx.restore();
                                        }
                                    }
                                } else if (entity.type === 'SHIELD') {
                                    // 1. Render Central Structure
                                    ctx.save();
                                    ctx.translate(entity.x, entity.y);
                                    ctx.beginPath();
                                    // Base square
                                    ctx.rect(
                                        -radius,
                                        -radius,
                                        radius * 2,
                                        radius * 2
                                    );
                                    ctx.fillStyle = color;
                                    ctx.shadowBlur = 10;
                                    ctx.shadowColor = color;
                                    ctx.fill();

                                    // Glowing core
                                    ctx.beginPath();
                                    ctx.arc(0, 0, radius * 0.6, 0, Math.PI * 2);
                                    ctx.fillStyle = '#fff';
                                    ctx.fill();
                                    ctx.restore();

                                    // 2. Render Barrier Bubble (if active and NOT disabled)
                                    if (entity.barrierHp > 0 && !isDisabled) {
                                        ctx.save();
                                        ctx.translate(entity.x, entity.y);

                                        const bStats = ENTITY_STATS.SHIELD;
                                        const bRadius = bStats.range;
                                        const time = Date.now() / 1000;

                                        // Pulse and HP feedback
                                        const hpFactor = entity.barrierHp / bStats.barrierHpMax;
                                        const pulse = 1.0; // Static (No breathing)
                                        const currentRadius = bRadius * pulse;

                                        if (entity.barrierHp < 2 && Math.sin(time * 20) > 0.5) {
                                            ctx.globalAlpha *= 0.3;
                                        }

                                        // A. Base Circular Bubble
                                        ctx.beginPath();
                                        ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);

                                        // Gradient Fill
                                        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, currentRadius);
                                        grad.addColorStop(0, `rgba(0, 255, 255, ${0.1 * hpFactor + 0.1})`);
                                        grad.addColorStop(0.9, `rgba(0, 255, 255, ${0.05 * hpFactor})`);
                                        grad.addColorStop(1, 'rgba(0, 255, 255, 0)');
                                        ctx.fillStyle = grad;
                                        ctx.fill();

                                        // B. Circular Boundary Stroke
                                        ctx.strokeStyle = VISUAL_STATS.SHIELD.color;
                                        ctx.lineWidth = 3; // Thicker border
                                        ctx.globalAlpha = 0.6 * hpFactor + 0.3; // Higher contrast
                                        ctx.stroke();

                                        // C. Hexagonal Overly (Honeycomb)
                                        ctx.save();
                                        ctx.beginPath();
                                        ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
                                        ctx.clip();

                                        const hexSize = 18;
                                        const hDist = hexSize * 1.5;
                                        const vDist = hexSize * Math.sqrt(3);

                                        ctx.strokeStyle = "#fff";
                                        ctx.lineWidth = 0.8;

                                        const cols = Math.ceil(currentRadius / hDist) + 1;
                                        const rows = Math.ceil(currentRadius / vDist) + 1;

                                        for (let q = -cols; q <= cols; q++) {
                                            for (let r = -rows; r <= rows; r++) {
                                                const x = q * hDist;
                                                const posY = r * vDist + (Math.abs(q) % 2 === 1 ? vDist / 2 : 0);

                                                const dist = Math.sqrt(x * x + posY * posY);
                                                if (dist < currentRadius + hexSize) {
                                                    // Hexagon distance-based alpha (fade out near edges)
                                                    // Ensure alpha is clamped [0, 0.2] and symmetric
                                                    const alpha = Math.max(0, 0.2 * (1 - dist / currentRadius)) * hpFactor;
                                                    ctx.globalAlpha = alpha;

                                                    ctx.beginPath();
                                                    for (let i = 0; i < 6; i++) {
                                                        const angle = (i * Math.PI) / 3;
                                                        const vx = x + hexSize * Math.cos(angle);
                                                        const vy = posY + hexSize * Math.sin(angle);
                                                        if (i === 0) ctx.moveTo(vx, vy);
                                                        else ctx.lineTo(vx, vy);
                                                    }
                                                    ctx.closePath();
                                                    ctx.stroke();
                                                }
                                            }
                                        }
                                        ctx.restore();

                                        ctx.restore();
                                    }
                                } else if (entity.type === 'CLOAKING_FIELD') {
                                    // 1. Render Central Structure (The Emitter)
                                    ctx.save();
                                    const time = Date.now();
                                    const isOwner = entity.owner === myPlayerId;

                                    let drawX = entity.x;
                                    let drawY = entity.y;

                                    if (!isOwner && !isDisabled) {
                                        // Obfuscate center with slight jitter to prevent easy sniping
                                        drawX += Math.sin(time / 50) * 2;
                                        drawY += Math.cos(time / 70) * 2;
                                        ctx.globalAlpha *= 0.6;
                                    }

                                    ctx.translate(drawX, drawY);

                                    // Base Diamond/Rhombus shape
                                    ctx.beginPath();
                                    ctx.moveTo(0, -radius);
                                    ctx.lineTo(radius, 0);
                                    ctx.lineTo(0, radius);
                                    ctx.lineTo(-radius, 0);
                                    ctx.closePath();
                                    ctx.fillStyle = color;
                                    ctx.fill();

                                    // Inner rotating/pulsing core
                                    const rotation = time / 600;
                                    ctx.rotate(rotation);
                                    ctx.strokeStyle = '#fff';
                                    ctx.lineWidth = 2;
                                    ctx.strokeRect(-radius * 0.4, -radius * 0.4, radius * 0.8, radius * 0.8);

                                    ctx.restore();

                                    // 2. Render Cloaking Radius (Static for owner, Intermittent for enemy)
                                    const cloakRange = ENTITY_STATS.CLOAKING_FIELD.cloakRange || 300;

                                    if (isOwner) {
                                        // Owner sees a permanent faint range circle
                                        ctx.save();
                                        ctx.beginPath();
                                        ctx.arc(entity.x, entity.y, cloakRange, 0, Math.PI * 2);
                                        ctx.strokeStyle = color;
                                        ctx.lineWidth = 2;
                                        ctx.globalAlpha = 0.2;
                                        ctx.stroke();

                                        // Light fill
                                        ctx.fillStyle = color;
                                        ctx.globalAlpha = 0.05;
                                        ctx.fill();
                                        ctx.restore();
                                    } else if (!isDisabled) {
                                        // Enemy sees an intermittent shimmer (every 5 seconds)
                                        const shimmerCycle = 5000;
                                        const shimmerDuration = 1000;
                                        const seed = entity.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                                        const offset = seed % shimmerCycle;
                                        const elapsed = (time + offset) % shimmerCycle;

                                        if (elapsed < shimmerDuration) {
                                            const progress = elapsed / shimmerDuration;
                                            const shimmerAlpha = Math.sin(progress * Math.PI) * 0.3;

                                            ctx.save();
                                            // Wavy effect: Draw the circle with a slight distortion
                                            ctx.beginPath();
                                            const segments = 64;
                                            for (let i = 0; i <= segments; i++) {
                                                const ang = (i / segments) * Math.PI * 2;
                                                const distortion = Math.sin(ang * 12 + time / 150) * 8 * progress;
                                                const r = cloakRange + distortion;
                                                const px = entity.x + Math.cos(ang) * r;
                                                const py = entity.y + Math.sin(ang) * r;
                                                if (i === 0) ctx.moveTo(px, py);
                                                else ctx.lineTo(px, py);
                                            }
                                            ctx.strokeStyle = "rgba(200, 200, 255, " + shimmerAlpha + ")";
                                            ctx.lineWidth = 4;
                                            ctx.stroke();
                                            ctx.restore();
                                        }
                                    }
                                } else if (entity.type === 'NUKE') {
                                    // Enhanced Nuke Icon (Landed)
                                    ctx.save();
                                    ctx.translate(entity.x, entity.y);
                                    const time = Date.now();

                                    const remainingTurns =
                                        (entity.detonationTurn || 0) - currentGameState.turn;
                                    const isDetonating = remainingTurns <= 0;
                                    const isCritical = remainingTurns <= 1;

                                    // Pulse math
                                    const pulseSpeed = isDetonating ? 50 : isCritical ? 150 : 300;
                                    const pulseFactor = Math.sin(time / pulseSpeed);
                                    const pulseScale = 1 + pulseFactor * (isDetonating ? 0.25 : 0.1);

                                    // 1. Pulsing Outer Aura (Glow)
                                    ctx.save();
                                    const auraAlpha = isDetonating
                                        ? 0.4 + (pulseFactor + 1) * 0.2
                                        : 0.15 + (pulseFactor + 1) * 0.15;
                                    ctx.globalAlpha = auraAlpha;
                                    ctx.fillStyle = isDetonating
                                        ? '#ff0000'
                                        : isCritical
                                            ? '#ff3300'
                                            : '#f1c40f';
                                    ctx.beginPath();
                                    ctx.arc(0, 0, radius * 2.2 * pulseScale, 0, Math.PI * 2);
                                    ctx.fill();
                                    ctx.restore();

                                    // 2. Main Hexagon Body
                                    ctx.beginPath();
                                    for (let i = 0; i < 6; i++) {
                                        const a = (i * 2 * Math.PI) / 6;
                                        ctx.lineTo(
                                            radius * Math.cos(a) * pulseScale,
                                            radius * Math.sin(a) * pulseScale
                                        );
                                    }
                                    ctx.closePath();
                                    ctx.fillStyle = isDetonating
                                        ? '#8b0000'
                                        : isCritical
                                            ? '#e74c3c'
                                            : '#f39c12';
                                    ctx.fill();
                                    ctx.strokeStyle = '#fff';
                                    ctx.lineWidth = isDetonating ? 4 : 2;
                                    ctx.stroke();

                                    // 3. Radiation Symbol (Trefoil)
                                    ctx.save();
                                    ctx.scale(pulseScale, pulseScale);
                                    ctx.fillStyle = isDetonating ? '#ff0000' : '#000';
                                    ctx.globalAlpha = isDetonating ? 1.0 : 0.6;
                                    ctx.beginPath();
                                    ctx.arc(0, 0, radius * 0.2, 0, Math.PI * 2);
                                    ctx.fill();
                                    for (let i = 0; i < 3; i++) {
                                        ctx.beginPath();
                                        ctx.moveTo(0, 0);
                                        const startA = (i * 120 - 30) * (Math.PI / 180);
                                        const endA = (i * 120 + 30) * (Math.PI / 180);
                                        ctx.arc(0, 0, radius * 0.8, startA, endA);
                                        ctx.closePath();
                                        ctx.fill();
                                    }
                                    ctx.restore();

                                    // 4. Integrated Countdown / Label
                                    ctx.fillStyle = '#fff';
                                    ctx.font = `bold ${radius * (isDetonating ? 0.6 : 0.9)}px Orbitron, Arial`;
                                    ctx.textAlign = 'center';
                                    ctx.textBaseline = 'middle';
                                    ctx.shadowBlur = 10;
                                    ctx.shadowColor = '#000';
                                    if (isDetonating) {
                                        ctx.fillText('CRITICAL', 0, 0);
                                    } else if (remainingTurns > 0) {
                                        ctx.fillText(remainingTurns.toString(), 0, 0);
                                    }
                                    ctx.restore();

                                    // 5. Detonation Radius Preview (Subtle Circle)
                                    if (entity.owner === myPlayerId) {
                                        ctx.save();
                                        ctx.setLineDash([5, 10]);
                                        ctx.strokeStyle = 'rgba(255, 50, 50, 0.4)';
                                        ctx.lineWidth = 2;
                                        ctx.beginPath();
                                        ctx.arc(
                                            entity.x,
                                            entity.y,
                                            ENTITY_STATS.NUKE.radiusFull,
                                            0,
                                            Math.PI * 2
                                        );
                                        ctx.stroke();
                                        ctx.restore();
                                    }
                                } else {
                                    if (entity.itemType === 'RECLAIMER') {
                                        ctx.save();
                                        ctx.fillStyle = '#00ffff';
                                        ctx.shadowBlur = 10;
                                        ctx.shadowColor = '#00ffff';
                                        ctx.beginPath();
                                        ctx.arc(entity.x, entity.y, radius, 0, Math.PI * 2);
                                        ctx.fill();
                                        ctx.restore();
                                    } else {
                                        ctx.beginPath();
                                        ctx.arc(entity.x, entity.y, radius, 0, Math.PI * 2);
                                        ctx.fill();
                                    }
                                }
                                if (isUndeployed) {
                                    ctx.stroke();
                                }
                            }

                            if (isSelected) {
                                ctx.strokeStyle = '#fff';
                                ctx.lineWidth = 3;
                                ctx.stroke();

                                if (
                                    launchMode &&
                                    entity.type === 'HUB' &&
                                    entity.owner === myPlayerId &&
                                    !displayAsGhost
                                ) {
                                    ctx.save();
                                    ctx.setLineDash([8, 12]);
                                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                                    ctx.lineWidth = 2;

                                    // Use toroidal distance for robust highlight detection
                                    const d = getToroidalDist(
                                        entity.x,
                                        entity.y,
                                        mousePos.x,
                                        mousePos.y,
                                        mapW,
                                        mapH
                                    );
                                    const ringHighlight = shouldHighlightRing(
                                        d,
                                        SLING_RING_RADIUS,
                                        isAiming && entity.id === selectedHubId
                                    );

                                    if (ringHighlight) {
                                        const isActive = isAiming && entity.id === selectedHubId;
                                        ctx.strokeStyle = isActive
                                            ? 'rgba(255, 255, 255, 0.95)'
                                            : 'rgba(255, 255, 255, 0.7)';
                                        ctx.shadowBlur = isActive ? 15 : 10;
                                        ctx.shadowColor = '#fff';
                                    }

                                    ctx.beginPath();
                                    ctx.arc(entity.x, entity.y, SLING_RING_RADIUS, 0, Math.PI * 2);
                                    ctx.stroke();
                                    ctx.restore();

                                    // Task 4: Draw North-offset ghosted icon of selected item
                                    if (selectedItemType && selectedItemType !== 'HUB') {
                                        ctx.save();
                                        ctx.globalAlpha = 0.5;
                                        ctx.translate(entity.x, entity.y - 60);

                                        // Draw simplified ghost of the structure
                                        ctx.beginPath();
                                        ctx.strokeStyle = '#fff';
                                        ctx.setLineDash([2, 4]);
                                        ctx.lineWidth = 1;

                                        const iconSize = (ENTITY_STATS[selectedItemType]?.size || 15) * 0.8;

                                        if (selectedItemType.includes('DEFENSE') || selectedItemType === 'SHIELD') {
                                            ctx.strokeRect(-iconSize, -iconSize, iconSize * 2, iconSize * 2);
                                        } else if (selectedItemType === 'EXTRACTOR') {
                                            ctx.moveTo(0, -iconSize);
                                            ctx.lineTo(iconSize, iconSize);
                                            ctx.lineTo(-iconSize, iconSize);
                                            ctx.closePath();
                                            ctx.stroke();
                                        } else {
                                            ctx.arc(0, 0, iconSize, 0, Math.PI * 2);
                                            ctx.stroke();
                                        }

                                        // Label for the ghost
                                        ctx.fillStyle = '#fff';
                                        ctx.font = '8px Arial';
                                        ctx.textAlign = 'center';
                                        ctx.fillText(selectedItemType, 0, iconSize + 10);

                                        ctx.restore();
                                    }
                                }
                            }
                            ctx.restore();

                            // Draw label if not a projectile or beam
                            const isTransEntity =
                                entity.type === 'PROJECTILE' ||
                                ENTITY_STATS[entity.itemType || entity.type]?.damageFull !==
                                undefined ||
                                entity.type === 'LASER_BEAM';
                            if (!isTransEntity) {
                                ctx.save();
                                ctx.globalAlpha = displayAsGhost ? 0.3 : 0.8;
                                ctx.fillStyle = '#fff';
                                ctx.font = displayAsGhost ? 'italic 10px Arial' : '10px Arial';
                                ctx.textAlign = 'center';
                                const labelOffset =
                                    ENTITY_STATS[entity.itemType || entity.type]?.labelOffset || 35;
                                ctx.fillText(
                                    displayAsGhost ? `Ghost ${entity.type}` : entity.type,
                                    entity.x,
                                    entity.y + labelOffset
                                );
                                ctx.restore();

                                if (
                                    entity.fuel !== undefined &&
                                    entity.owner === myPlayerId &&
                                    !displayAsGhost
                                ) {
                                    const dotYOffset = entity.type === 'HUB' ? -15 : -10;
                                    const dotXOffset = entity.type === 'HUB' ? 18 : 12;
                                    for (let i = 0; i < entity.maxFuel; i++) {
                                        ctx.beginPath();
                                        const dotY = entity.y + dotYOffset + i * 8;
                                        ctx.arc(entity.x + dotXOffset, dotY, 3, 0, Math.PI * 2);
                                        ctx.fillStyle = i < entity.fuel ? '#2ecc71' : '#444';
                                        ctx.fill();
                                    }
                                }

                                // Nuke Countdown logic moved to main rendering block
                            }
                        });

                        // 6. DRAW AIMING OVERLAY & UI previews
                        if (isAiming && selectedHubId) {
                            const hub = visualEntities.current[selectedHubId];
                            if (hub) {
                                // Calculate shortest vector once for world-wrap aware aiming
                                const { dx: shortestDx, dy: shortestDy } = getToroidalDistVector(
                                    hub.x,
                                    hub.y,
                                    mousePos.x,
                                    mousePos.y,
                                    mapW,
                                    mapH
                                );

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

                                const arrowLen = HUB_RADIUS * (1 + ratio * 0.5);
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
                                ctx.moveTo(0, 0);
                                ctx.lineTo(-12, -7);
                                ctx.lineTo(-12, 7);
                                ctx.closePath();
                                ctx.fill();
                                ctx.restore();

                                if (showDebugPreview) {
                                    let launchDistance = GameState.calculateLaunchDistance(distance);
                                    const stats = ENTITY_STATS[selectedItemType];
                                    if (stats?.minRange) {
                                        launchDistance = Math.max(stats.minRange, launchDistance);
                                    }
                                    const ldx = Math.cos(launchAngle) * launchDistance;
                                    const ldy = Math.sin(launchAngle) * launchDistance;
                                    const targetX = (hub.x + (ldx % mapW) + mapW) % mapW;
                                    const targetY = (hub.y + (ldy % mapH) + mapH) % mapH;

                                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                                    ctx.setLineDash([2, 5]);
                                    drawToroidalLine(
                                        ctx,
                                        hub.x,
                                        hub.y,
                                        targetX,
                                        targetY,
                                        mapW,
                                        mapH,
                                        ldx,
                                        ldy
                                    );
                                    ctx.setLineDash([]);

                                    const previewSize = stats?.size || 12;

                                    if (selectedItemType === 'CLUSTER_BOMB') {
                                        const count = stats.subBombCount;
                                        const totalSpread = stats.spreadDistance;
                                        const step = totalSpread / (count - 1 || 1);

                                        // Perpendicular unit vector
                                        const px = -ldy / launchDistance;
                                        const py = ldx / launchDistance;

                                        for (let i = 0; i < count; i++) {
                                            const offset = i * step - totalSpread / 2;
                                            const subTargetX = (targetX + offset * px + mapW) % mapW;
                                            const subTargetY = (targetY + offset * py + mapH) % mapH;

                                            ctx.beginPath();
                                            ctx.arc(subTargetX, subTargetY, previewSize, 0, Math.PI * 2);
                                            ctx.stroke();
                                        }
                                    } else {
                                        ctx.beginPath();
                                        if (selectedItemType === 'HUB' || selectedItemType === 'NUKE') {
                                            // Hexagon Preview
                                            for (let i = 0; i < 6; i++) {
                                                const a = (i * 2 * Math.PI) / 6;
                                                ctx.lineTo(
                                                    targetX + previewSize * Math.cos(a),
                                                    targetY + previewSize * Math.sin(a)
                                                );
                                            }
                                            ctx.closePath();
                                        } else if (selectedItemType === 'EXTRACTOR') {
                                            // Triangle Preview
                                            ctx.moveTo(targetX, targetY - previewSize);
                                            ctx.lineTo(targetX + previewSize, targetY + previewSize / 2);
                                            ctx.lineTo(targetX - previewSize, targetY + previewSize / 2);
                                            ctx.closePath();

                                            // Capture Radius Preview
                                            ctx.save();
                                            ctx.strokeStyle = VISUAL_STATS.EXTRACTOR.captureRadiusColor;
                                            ctx.setLineDash([5, 5]);
                                            ctx.beginPath();
                                            ctx.arc(targetX, targetY, GLOBAL_STATS.RESOURCE_CAPTURE_RADIUS, 0, Math.PI * 2);
                                            ctx.stroke();
                                            ctx.restore();
                                        } else if (
                                            selectedItemType === 'SHIELD' ||
                                            selectedItemType === 'LASER_POINT_DEFENSE' ||
                                            selectedItemType === 'FLAK_DEFENSE'
                                        ) {
                                            // Square Preview
                                            ctx.rect(targetX - previewSize, targetY - previewSize, previewSize * 2, previewSize * 2);
                                        } else {
                                            // Default Circle for projectiles
                                            ctx.arc(targetX, targetY, previewSize, 0, Math.PI * 2);
                                        }
                                        ctx.stroke();

                                        // AOE Preview for explosive weapons (Nuke, Weapon, Super Bomb, OVERLOAD) or SHIELD
                                        const explosionRadius = stats?.radiusFull || stats?.detectionRadius || stats?.range;
                                        if (explosionRadius) {
                                            ctx.save();

                                            const vStats = VISUAL_STATS[selectedItemType];
                                            const previewColor =
                                                selectedItemType === 'NUKE'
                                                    ? 'rgba(255, 0, 0, 0.7)'
                                                    : selectedItemType === 'RECLAIMER'
                                                        ? 'rgba(0, 255, 255, 0.7)'
                                                        : selectedItemType === 'SHIELD'
                                                            ? 'rgba(0, 255, 255, 0.5)'
                                                            : vStats?.color
                                                                ? `${vStats.color}b3`
                                                                : 'rgba(255, 255, 255, 0.5)';

                                            // 1. Full Damage Inner Ring (Solid-ish) / Shield Barrier
                                            ctx.strokeStyle = previewColor;
                                            ctx.lineWidth =
                                                selectedItemType === 'NUKE' ||
                                                    selectedItemType === 'RECLAIMER' ||
                                                    selectedItemType === 'OVERLOAD' ||
                                                    selectedItemType === 'SHIELD'
                                                    ? 3
                                                    : 2;
                                            ctx.setLineDash([10, 5]);
                                            ctx.beginPath();

                                            // Boundary is always circular for Shield now
                                            ctx.arc(targetX, targetY, explosionRadius, 0, Math.PI * 2);
                                            ctx.stroke();

                                            // Add subtle boundary preview for Shield
                                            if (selectedItemType === "SHIELD") {
                                                // Just the boundary ring, no internal hexes for the preview
                                            }
                                            // 2. Splash Damage Outer Ring (Dashed/Subtle)
                                            if (stats.radiusHalf && stats.radiusHalf > stats.radiusFull) {
                                                ctx.strokeStyle =
                                                    selectedItemType === 'NUKE'
                                                        ? 'rgba(255, 140, 0, 0.5)'
                                                        : 'rgba(255, 255, 255, 0.3)';
                                                ctx.lineWidth = 1.5;
                                                ctx.setLineDash([5, 15]);
                                                ctx.beginPath();
                                                ctx.arc(targetX, targetY, stats.radiusHalf, 0, Math.PI * 2);
                                                ctx.stroke();
                                            }

                                            ctx.restore();
                                        }

                                        // Napalm AOE Preview during aiming
                                        if (selectedItemType === 'NAPALM') {
                                            ctx.save();
                                            const nStats = ENTITY_STATS.NAPALM_FIRE;
                                            const { dx, dy } = getToroidalDistVector(
                                                hub.x,
                                                hub.y,
                                                targetX,
                                                targetY,
                                                mapW,
                                                mapH
                                            );
                                            const angle = Math.atan2(dy, dx);
                                            const radius = nStats.width / 2;

                                            ctx.translate(targetX, targetY);
                                            ctx.rotate(angle);
                                            ctx.strokeStyle = 'rgba(255, 140, 0, 0.6)';
                                            ctx.lineWidth = 2;
                                            ctx.setLineDash([5, 5]);

                                            ctx.beginPath();
                                            // Remember: TargetX is the TIP, so we draw BACKWARDS (negative length)
                                            ctx.arc(0, 0, radius, -Math.PI / 2, Math.PI / 2);
                                            ctx.lineTo(-nStats.length, radius);
                                            ctx.arc(-nStats.length, 0, radius, Math.PI / 2, -Math.PI / 2);
                                            ctx.closePath();
                                            ctx.stroke();
                                            ctx.restore();
                                        }
                                    }
                                }
                            }
                        }

                        // committed actions preview - moved out of isAiming block to stay visible
                        committedActions.forEach((action, index) => {
                            const hub = visualEntities.current[action.sourceId];
                            if (hub) {
                                const angleRad = (action.angle * Math.PI) / 180;
                                const ratio = action.distance / maxPullDistance;
                                const strengthColor = getStrengthColor(ratio);
                                const arrowLen = HUB_RADIUS * (1 + ratio * 0.5);
                                const ax = hub.x + Math.cos(angleRad) * arrowLen;
                                const ay = hub.y + Math.sin(angleRad) * arrowLen;

                                ctx.strokeStyle = strengthColor;
                                ctx.lineWidth = 4;
                                ctx.globalAlpha = 0.6;
                                ctx.beginPath();
                                ctx.moveTo(hub.x, hub.y);
                                ctx.lineTo(ax, ay);
                                ctx.stroke();
                                ctx.globalAlpha = 1.0;

                                ctx.fillStyle = strengthColor;
                                ctx.beginPath();
                                ctx.arc(
                                    ax + Math.cos(angleRad) * 15,
                                    ay + Math.sin(angleRad) * 15,
                                    10,
                                    0,
                                    Math.PI * 2
                                );
                                ctx.fill();
                                ctx.fillStyle = '#fff';
                                ctx.font = 'bold 10px Arial';
                                ctx.textAlign = 'center';
                                ctx.fillText(
                                    (index + 1).toString(),
                                    ax + Math.cos(angleRad) * 15,
                                    ay + Math.sin(angleRad) * 15 + 4
                                );
                            }
                        });

                        ctx.restore();
                    }
                }
                ctx.restore();

            } catch (err) {
                console.error("Rendering Error:", err);
            }
            animationFrameId = requestAnimationFrame(updateAndDraw);
        };

        animationFrameId = requestAnimationFrame(updateAndDraw);
        return () => cancelAnimationFrame(animationFrameId);
    }, [
        gameState,
        launchMode,
        isAiming,
        selectedHubId,
        selectedItemType,
        mousePos,
        committedActions,
        showDebugPreview,
        maxPullDistance,
        myPlayerId,
        cameraOffset,
        HUB_RADIUS,
        SLING_RING_RADIUS
    ]);

    // Helper: Calculate game coordinates from mouse event
    const getGameCoords = useCallback(
        (e) => {
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
                offsetX = (rw - cw / scale) / 2;
                offsetY = 0;
            } else {
                scale = cw / rw;
                offsetX = 0;
                offsetY = (rh - ch / scale) / 2;
            }

            const x = ((e.clientX - rect.left - offsetX) * scale) / ZOOM_LEVEL + cameraOffset.x;
            const y = ((e.clientY - rect.top - offsetY) * scale) / ZOOM_LEVEL + cameraOffset.y;
            return {
                x: ((x % gameState.map.width) + gameState.map.width) % gameState.map.width,
                y: ((y % gameState.map.height) + gameState.map.height) % gameState.map.height
            };
        },
        [cameraOffset, gameState.map.width, gameState.map.height]
    );

    const getScreenCoords = useCallback((gameX, gameY) => {
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
            offsetX = (rw - cw / scale) / 2;
            offsetY = 0;
        } else {
            scale = cw / rw;
            offsetX = 0;
            offsetY = (rh - ch / scale) / 2;
        }

        const dx = gameX - cameraOffset.x;
        const dy = gameY - cameraOffset.y;

        // Viewport-absolute coordinates (master baseline)
        const primaryX = (dx * ZOOM_LEVEL) / scale + rect.left + offsetX;
        const primaryY = (dy * ZOOM_LEVEL) / scale + rect.top + offsetY;

        // We need to account for the 3x3 tiling in the GameBoard.
        // The menu should follow the instance that is actually ON SCREEN.
        const mapPixelW = (gameState.map.width * ZOOM_LEVEL) / scale;
        const mapPixelH = (gameState.map.height * ZOOM_LEVEL) / scale;

        const xInstances = [primaryX - mapPixelW, primaryX, primaryX + mapPixelW];
        const yInstances = [primaryY - mapPixelH, primaryY, primaryY + mapPixelH];

        // Find the instance closest to viewport center that is also ideally on screen
        const viewportCenterX = rect.left + rw / 2;
        const viewportCenterY = rect.top + rh / 2;

        const findBest = (instances, center, min, max) => {
            let best = instances[1]; // default to primary
            let minCenterDist = Infinity;
            let foundVisible = false;

            for (const val of instances) {
                const isVisible = val >= min && val <= max;
                const dist = Math.abs(val - center);

                if (isVisible && !foundVisible) {
                    best = val;
                    minCenterDist = dist;
                    foundVisible = true;
                } else if (isVisible && foundVisible) {
                    if (dist < minCenterDist) {
                        best = val;
                        minCenterDist = dist;
                    }
                } else if (!foundVisible) {
                    if (dist < minCenterDist) {
                        best = val;
                        minCenterDist = dist;
                    }
                }
            }
            return best;
        };

        const finalX = findBest(xInstances, viewportCenterX, rect.left, rect.left + rw);
        const finalY = findBest(yInstances, viewportCenterY, rect.top, rect.top + rh);

        return { x: finalX, y: finalY };
    }, [cameraOffset, ZOOM_LEVEL, gameState.map.width, gameState.map.height]);

    useImperativeHandle(ref, () => ({
        getScreenCoords,
        getGameCoords
    }));

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
                const dx = e.clientX - panStartRef.current.x;
                const dy = e.clientY - panStartRef.current.y;

                // Move camera (account for canvas scale)
                const canvas = canvasRef.current;
                const rect = canvas.getBoundingClientRect();
                if (!rect.width || !rect.height) return;

                const scale = canvas.width / rect.width;
                if (isNaN(scale) || !isFinite(scale)) return;

                setCameraOffset((prev) => ({
                    x: (prev.x - (((dx * scale) / ZOOM_LEVEL) % gameState.map.width) + gameState.map.width) % gameState.map.width,
                    y: (prev.y - (((dy * scale) / ZOOM_LEVEL) % gameState.map.height) + gameState.map.height) % gameState.map.height
                }));

                panStartRef.current = { x: e.clientX, y: e.clientY };
            }
        };

        const handleGlobalMouseUp = (e) => {
            if (isAiming) {
                const { x, y } = getGameCoords(e);
                onAimEnd(x, y);
            }

            if (isPanning) {
                const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
                const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
                const isShortClick = dx < 5 && dy < 5;

                if (isShortClick) {
                    const { x: gameX, y: gameY } = getGameCoords(e);

                    // Check for hub click
                    const clickedHub = gameState.entities.find((ent) => {
                        if (ent.type !== 'HUB') return false;
                        const d = getToroidalDist(
                            ent.x,
                            ent.y,
                            gameX,
                            gameY,
                            gameState.map.width,
                            gameState.map.height
                        );
                        return d < HUB_RADIUS;
                    });

                    if (clickedHub && clickedHub.owner === myPlayerId) {
                        onSelectHub(clickedHub.id);
                    } else {
                        onSelectHub(null);
                    }
                }
            }

            setIsPanning(false);
        };

        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [
        isAiming,
        isPanning,
        gameState.map.width,
        gameState.map.height,
        getGameCoords,
        onAimEnd,
        onAimUpdate,
        onSelectHub,
        HUB_RADIUS,
        myPlayerId,
        setCameraOffset
    ]);

    const handleMouseDown = (e) => {
        const { x, y } = getGameCoords(e);

        // 1. If launchMode is active, ONLY allow interaction with the Sling Ring
        if (launchMode && selectedHubId) {
            const currentHub = gameState.entities.find((e) => e.id === selectedHubId);
            if (currentHub && currentHub.owner === myPlayerId) {
                const d = getToroidalDist(
                    currentHub.x,
                    currentHub.y,
                    x,
                    y,
                    gameState.map.width,
                    gameState.map.height
                );
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

        // 2. Normal mode: Selection handled in mouseup

        // 3. Middle click or Left click on empty space starts pan tracking
        if (e.button === 0 || e.button === 1) {
            setIsPanning(true);
            panStartRef.current = { x: e.clientX, y: e.clientY };
            mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
        }
    };

    return (
        <div
            className="game-container"
            style={{
                background: '#111',
                border: '1px solid #333',
                borderRadius: '8px',
                overflow: 'hidden'
            }}
        >
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
});

export default GameBoard;
