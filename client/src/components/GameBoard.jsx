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

    const drawToroidalLine = (ctx, x1, y1, x2, y2, width, height) => {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const wrapsX = Math.abs(dx) > width / 2;
        const wrapsY = Math.abs(dy) > height / 2;

        if (!wrapsX && !wrapsY) {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            return;
        }

        // Handle wrapping by drawing offset segments
        const ox = wrapsX ? (dx > 0 ? -width : width) : 0;
        const oy = wrapsY ? (dy > 0 ? -height : height) : 0;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2 + ox, y2 + oy);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x1 - ox, y1 - oy);
        ctx.lineTo(x2, y2);
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

            // 2b. DRAW GRID
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 1;
            const gridSize = 100;
            for (let x = 0; x <= mapW; x += gridSize) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, mapH);
                ctx.stroke();
            }
            for (let y = 0; y <= mapH; y += gridSize) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(mapW, y);
                ctx.stroke();
            }

            // 3. DRAW LINKS
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 2;
            gameState.links.forEach(link => {
                const from = visualEntities.current[link.from];
                const to = visualEntities.current[link.to];
                if (from && to) {
                    drawToroidalLine(ctx, from.x, from.y, to.x, to.y, mapW, mapH);
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
                    const radius = entity.type === 'HUB' ? 40 : 20;
                    ctx.arc(entity.x, entity.y, radius, 0, Math.PI * 2);
                    ctx.fill();
                }

                if (isSelected) {
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                }
                ctx.restore();

                if (entity.type !== 'PROJECTILE') {
                    ctx.fillStyle = '#fff';
                    ctx.font = '10px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(entity.type, entity.x, entity.y + 35);

                    // 3b. Draw Fuel Gauge (Green dots in top-right) - ONLY FOR OWNED STRUCTURES
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
                    let dx = mousePos.x - hub.x;
                    let dy = mousePos.y - hub.y;
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

                    const arrowLen = 40 * (1 + (ratio * 0.5));
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
                        const targetX = ((hub.x + Math.cos(launchAngle) * launchDistance % mapW) + mapW) % mapW;
                        const targetY = ((hub.y + Math.sin(launchAngle) * launchDistance % mapH) + mapH) % mapH;
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                        ctx.setLineDash([2, 5]);
                        drawToroidalLine(ctx, hub.x, hub.y, targetX, targetY, mapW, mapH);
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
                    const arrowLen = 40 * (1 + (ratio * 0.5));
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

            animationFrameId = requestAnimationFrame(updateAndDraw);
        };

        animationFrameId = requestAnimationFrame(updateAndDraw);
        return () => cancelAnimationFrame(animationFrameId);
    }, [gameState, isAiming, selectedHubId, mousePos, committedActions, showDebugPreview, maxPullDistance, myPlayerId]);

    const handleMouseDown = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        // Calculate scaling and offsets for 'objectFit: contain'
        const cw = canvas.width;
        const ch = canvas.height;
        const rw = rect.width;
        const rh = rect.height;
        const canvasRatio = cw / ch;
        const rectRatio = rw / rh;

        let scale, offsetX, offsetY;
        if (rectRatio > canvasRatio) {
            // Height is the limiting factor (black bars on left/right)
            scale = ch / rh;
            offsetX = (rw - (cw / scale)) / 2;
            offsetY = 0;
        } else {
            // Width is the limiting factor (black bars on top/bottom)
            scale = cw / rw;
            offsetX = 0;
            offsetY = (rh - (ch / scale)) / 2;
        }

        const x = ((e.clientX - rect.left) - offsetX) * scale;
        const y = ((e.clientY - rect.top) - offsetY) * scale;

        const clickedHub = gameState.entities.find(ent => {
            if (ent.type !== 'HUB') return false;
            const d = Math.sqrt((ent.x - x) ** 2 + (ent.y - y) ** 2);
            return d < 40;
        });

        if (clickedHub && clickedHub.owner === myPlayerId) {
            onSelectHub(clickedHub.id);
            onAimStart(clickedHub.id, x, y);
        } else {
            // Clicked empty space or an enemy hub
            onSelectHub(null);
        }
    };

    const handleMouseMove = (e) => {
        const canvas = canvasRef.current;
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

        const x = ((e.clientX - rect.left) - offsetX) * scale;
        const y = ((e.clientY - rect.top) - offsetY) * scale;

        setMousePos({ x, y });
        if (isAiming) onAimUpdate(x, y);
    };

    const handleMouseUp = () => {
        if (isAiming) {
            console.log(`Launching from Hub at: (${mousePos.x.toFixed(1)}, ${mousePos.y.toFixed(1)})`);
            onAimEnd(mousePos.x, mousePos.y);
        }
    };

    return (
        <div className="game-container" style={{ background: '#111', border: '1px solid #333', borderRadius: '8px', overflow: 'hidden' }}>
            <canvas
                ref={canvasRef}
                width={gameState.map.width}
                height={gameState.map.height}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{ display: 'block', cursor: isAiming ? 'crosshair' : 'default', width: '100%', maxHeight: '80vh', objectFit: 'contain' }}
            />
        </div>
    );
};

export default GameBoard;
