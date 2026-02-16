import React, { useRef, useEffect, useState } from 'react';
import { GameState } from '../../../shared/GameState.js';

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

    const HUB_RADIUS = 40;
    const SLING_RING_RADIUS = 80;
    const RING_INTERACTION_BUFFER = 15;

    // visualEntities stores the smoothly-interpolated positions of all objects
    const visualEntities = useRef({});

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
            // 1. UPDATE VISUAL POSITIONS (Lerp)
            // LERP_FACTOR targets how fast we reach the server's state.
            const LERP_FACTOR = 0.3;

            gameState.entities.forEach(serverEnt => {
                if (!visualEntities.current[serverEnt.id]) {
                    visualEntities.current[serverEnt.id] = { ...serverEnt };
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
                    viz.maxFuel = serverEnt.maxFuel;
                }
            });

            const serverIds = new Set(gameState.entities.map(e => e.id));
            Object.keys(visualEntities.current).forEach(id => {
                if (!serverIds.has(id)) delete visualEntities.current[id];
            });

            // 2. CLEAR CANVAS
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // -----------------------------------------------------------------
            // 3x3 TILED RENDERING LOOP
            // This ensures objects near edges appear on the opposite side.
            // -----------------------------------------------------------------
            ctx.save();
            // Apply camera offset
            ctx.translate(-cameraOffset.x, -cameraOffset.y);

            for (let offsetOffsetX = -mapW; offsetOffsetX <= mapW; offsetOffsetX += mapW) {
                for (let offsetOffsetY = -mapH; offsetOffsetY <= mapH; offsetOffsetY += mapH) {
                    ctx.save();
                    ctx.translate(offsetOffsetX, offsetOffsetY);

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

                    // 3. DRAW LINKS
                    ctx.strokeStyle = '#444';
                    ctx.lineWidth = 2;
                    gameState.links.forEach(link => {
                        const from = visualEntities.current[link.from];
                        const to = visualEntities.current[link.to];
                        if (from && to) {
                            if (link.intendedDx !== null && link.intendedDx !== undefined) {
                                const targetX = from.x + link.intendedDx;
                                const targetY = from.y + link.intendedDy;
                                drawToroidalLine(ctx, from.x, from.y, targetX, targetY, mapW, mapH, link.intendedDx, link.intendedDy);
                            } else {
                                // Legacy shortest path
                                let dx = to.x - from.x;
                                let dy = to.y - from.y;
                                if (Math.abs(dx) > mapW / 2) dx = dx > 0 ? dx - mapW : dx + mapW;
                                if (Math.abs(dy) > mapH / 2) dy = dy > 0 ? dy - mapH : dy + mapH;
                                drawToroidalLine(ctx, from.x, from.y, from.x + dx, from.y + dy, mapW, mapH);
                            }
                        }
                    });

                    // 4. DRAW RESOURCES
                    gameState.map.resources.forEach(res => {
                        ctx.fillStyle = '#00ffcc';
                        ctx.beginPath();
                        ctx.arc(res.x, res.y, 8, 0, Math.PI * 2);
                        ctx.fill();
                    });

                    // 5. DRAW ENTITIES
                    Object.values(visualEntities.current).forEach(entity => {
                        const player = gameState.players[entity.owner];
                        const color = player ? player.color : '#fff';
                        const isSelected = entity.id === selectedHubId;

                        ctx.save();
                        ctx.fillStyle = color;
                        if (isSelected) {
                            ctx.shadowBlur = 15;
                            ctx.shadowColor = '#fff';
                        }

                        if (entity.type === 'PROJECTILE') {
                            ctx.save();
                            ctx.shadowBlur = 10;
                            ctx.shadowColor = color;
                            ctx.beginPath();
                            ctx.arc(entity.x, entity.y, 8, 0, Math.PI * 2);
                            ctx.fill();
                            ctx.restore();
                        } else {
                            ctx.beginPath();
                            const radius = entity.type === 'HUB' ? HUB_RADIUS : 20;
                            ctx.arc(entity.x, entity.y, radius, 0, Math.PI * 2);
                            ctx.fill();
                        }

                        if (isSelected) {
                            ctx.strokeStyle = '#fff';
                            ctx.lineWidth = 3;
                            ctx.stroke();

                            if (launchMode && entity.type === 'HUB' && entity.owner === myPlayerId) {
                                ctx.save();
                                ctx.setLineDash([8, 12]);
                                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                                ctx.lineWidth = 2;

                                // Account for tile translation when checking mouse highlight
                                const d = Math.sqrt((entity.x + offsetOffsetX - mousePos.x) ** 2 + (entity.y + offsetOffsetY - mousePos.y) ** 2);
                                const isInsideRing = d < SLING_RING_RADIUS;

                                if (isInsideRing) {
                                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                                    ctx.shadowBlur = 10;
                                    ctx.shadowColor = '#fff';
                                }

                                ctx.beginPath();
                                ctx.arc(entity.x, entity.y, SLING_RING_RADIUS, 0, Math.PI * 2);
                                ctx.stroke();
                                ctx.restore();
                            }
                        }
                        ctx.restore();

                        if (entity.type !== 'PROJECTILE') {
                            ctx.fillStyle = '#fff';
                            ctx.font = '10px Arial';
                            ctx.textAlign = 'center';
                            ctx.fillText(entity.type, entity.x, entity.y + 35);

                            if (entity.fuel !== undefined && entity.owner === myPlayerId) {
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

        const x = ((e.clientX - rect.left) - offsetX) * scale + cameraOffset.x;
        const y = ((e.clientY - rect.top) - offsetY) * scale + cameraOffset.y;
        return {
            x: ((x % gameState.map.width) + gameState.map.width) % gameState.map.width,
            y: ((y % gameState.map.height) + gameState.map.height) % gameState.map.height
        };
    };

    // Effect: Global Mouse Listeners for Panning & Aiming
    useEffect(() => {
        const handleGlobalMouseMove = (e) => {
            if (isAiming) {
                const { x, y } = getGameCoords(e);
                setMousePos({ x, y });
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
                    x: ((prev.x - dx * scale % gameState.map.width) + gameState.map.width) % gameState.map.width,
                    y: ((prev.y - dy * scale % gameState.map.height) + gameState.map.height) % gameState.map.height
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
