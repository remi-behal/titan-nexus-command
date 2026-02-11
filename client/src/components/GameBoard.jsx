import React, { useRef, useEffect, useState } from 'react';
import { GameState } from '../../../shared/GameState.js';

/**
 * GameBoard Component
 *  
 * Takes the 'gameState' and renders it using HTML5 Canvas.
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

    const getStrengthColor = (ratio) => {
        // Linear transition: Green (0,255,0) -> Orange (255,165,0) -> Red (255,0,0)
        let r, g, b = 0;
        if (ratio < 0.5) {
            // Green to Orange
            const segmentRatio = ratio * 2;
            r = Math.floor(255 * segmentRatio);
            g = Math.floor(255 - (90 * segmentRatio)); // 255 to 165
        } else {
            // Orange to Red
            const segmentRatio = (ratio - 0.5) * 2;
            r = 255;
            g = Math.floor(165 * (1 - segmentRatio)); // 165 to 0
        }
        return `rgb(${r}, ${g}, ${b})`;
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. Draw Links 
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 2;
        gameState.links.forEach(link => {
            const from = gameState.entities.find(e => e.id === link.from);
            const to = gameState.entities.find(e => e.id === link.to);
            if (from && to) {
                ctx.beginPath();
                ctx.moveTo(from.x, from.y);
                ctx.lineTo(to.x, to.y);
                ctx.stroke();
            }
        });

        // 2. Draw Resource Nodes
        gameState.map.resources.forEach(res => {
            ctx.fillStyle = '#00ffcc';
            ctx.beginPath();
            ctx.arc(res.x, res.y, 8, 0, Math.PI * 2);
            ctx.fill();
        });

        // 3. Draw Entities
        gameState.entities.forEach(entity => {
            const player = gameState.players[entity.owner];
            const color = player ? player.color : '#fff';

            const isSelected = entity.id === selectedHubId;

            ctx.save();
            ctx.fillStyle = color;
            if (isSelected) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#fff';
            }

            ctx.beginPath();
            ctx.arc(entity.x, entity.y, entity.type === 'HUB' ? 20 : 10, 0, Math.PI * 2);
            ctx.fill();

            if (isSelected) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
            ctx.restore();

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
                    // Stack dots vertically in the top-right area
                    const dotX = entity.x + dotXOffset;
                    const dotY = entity.y + dotYOffset + (i * 8);

                    ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);

                    if (i < (entity.maxFuel - entity.fuel)) {
                        // Consumed fuel: Hollow circle
                        ctx.strokeStyle = '#2ecc71';
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    } else {
                        // Available fuel: Filled circle
                        ctx.fillStyle = '#2ecc71';
                        ctx.fill();
                    }
                }
            }
        });

        // 4. Draw Slingshot Preview while aiming
        if (isAiming && selectedHubId) {
            const hub = gameState.entities.find(e => e.id === selectedHubId);
            if (hub) {
                let dx = mousePos.x - hub.x;
                let dy = mousePos.y - hub.y;
                let distance = Math.sqrt(dx * dx + dy * dy);

                // Clamp visual pull
                if (distance > maxPullDistance) {
                    const angle = Math.atan2(dy, dx);
                    dx = Math.cos(angle) * maxPullDistance;
                    dy = Math.sin(angle) * maxPullDistance;
                    distance = maxPullDistance;
                }

                const ratio = distance / maxPullDistance;
                const strengthColor = getStrengthColor(ratio);

                // Draw the "Pull Back" line (to mouse)
                ctx.setLineDash([5, 5]);
                ctx.strokeStyle = '#fff';
                ctx.beginPath();
                ctx.moveTo(hub.x, hub.y);
                ctx.lineTo(hub.x + dx, hub.y + dy);
                ctx.stroke();
                ctx.setLineDash([]);

                // Draw the "Launch" indicator (opposite side) - POWER GAUGE
                const launchAngle = Math.atan2(-dy, -dx);
                // Fixed-length base + slight scaling (decoupled from actual map distance)
                const arrowBaseLen = 40;
                const arrowScale = 1 + (ratio * 0.5); // Grows by up to 50%
                const arrowLen = arrowBaseLen * arrowScale;

                const arrowX = hub.x + Math.cos(launchAngle) * arrowLen;
                const arrowY = hub.y + Math.sin(launchAngle) * arrowLen;

                // Draw Launch Arrow
                ctx.strokeStyle = strengthColor;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(hub.x, hub.y);
                ctx.lineTo(arrowX, arrowY);
                ctx.stroke();

                // Arrow head
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

                // Draw PINPOINT PREVIEW (Only if enabled)
                if (showDebugPreview) {
                    const launchDistance = GameState.calculateLaunchDistance(distance);
                    const targetX = hub.x + Math.cos(launchAngle) * launchDistance;
                    const targetY = hub.y + Math.sin(launchAngle) * launchDistance;

                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.setLineDash([2, 5]);
                    ctx.beginPath();
                    ctx.moveTo(hub.x, hub.y);
                    ctx.lineTo(targetX, targetY);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                    ctx.beginPath();
                    ctx.arc(targetX, targetY, 12, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // 5. Draw Committed Actions (Frozen Arrows + Numbers)
        committedActions.forEach((action, index) => {
            const hub = gameState.entities.find(e => e.id === action.sourceId);
            if (hub) {
                const angleRad = (action.angle * Math.PI) / 180;
                const ratio = action.distance / maxPullDistance;
                const strengthColor = getStrengthColor(ratio);

                // --- 5a. Draw Frozen Power Arrow ---
                const arrowBaseLen = 40;
                const arrowScale = 1 + (ratio * 0.5);
                const arrowLen = arrowBaseLen * arrowScale;

                const arrowX = hub.x + Math.cos(angleRad) * arrowLen;
                const arrowY = hub.y + Math.sin(angleRad) * arrowLen;

                ctx.save();
                ctx.strokeStyle = strengthColor;
                ctx.lineWidth = 4;
                ctx.globalAlpha = 0.8; // Slightly transparent to show it's committed
                ctx.beginPath();
                ctx.moveTo(hub.x, hub.y);
                ctx.lineTo(arrowX, arrowY);
                ctx.stroke();

                // Arrow head
                ctx.translate(arrowX, arrowY);
                ctx.rotate(angleRad);
                ctx.fillStyle = strengthColor;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(-12, -7);
                ctx.lineTo(-12, 7);
                ctx.closePath();
                ctx.fill();
                ctx.restore();

                // --- 5b. Draw Action Number ---
                ctx.save();
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                // Position number just past the arrow tip
                const textDist = arrowLen + 15;
                const tx = hub.x + Math.cos(angleRad) * textDist;
                const ty = hub.y + Math.sin(angleRad) * textDist;

                // Draw a small circle background for the number
                ctx.fillStyle = strengthColor;
                ctx.beginPath();
                ctx.arc(tx, ty, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.fillStyle = '#fff';
                ctx.fillText((index + 1).toString(), tx, ty + 4);
                ctx.restore();

                // --- 5c. Optional Full Landing Preview (Behind Toggle) ---
                if (showDebugPreview) {
                    ctx.save();
                    ctx.strokeStyle = 'rgba(128, 128, 128, 0.4)';
                    ctx.setLineDash([5, 5]);

                    const launchDistance = GameState.calculateLaunchDistance(action.distance);
                    const targetX = action.sourceX + Math.cos(angleRad) * launchDistance;
                    const targetY = action.sourceY + Math.sin(angleRad) * launchDistance;

                    ctx.beginPath();
                    ctx.moveTo(action.sourceX, action.sourceY);
                    ctx.lineTo(targetX, targetY);
                    ctx.stroke();

                    ctx.fillStyle = 'rgba(128, 128, 128, 0.3)';
                    ctx.beginPath();
                    ctx.arc(targetX, targetY, 12, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = '#888';
                    ctx.font = '10px Arial';
                    ctx.fillText("Target Area", targetX, targetY - 18);
                    ctx.restore();
                }
            }
        });

    }, [gameState, selectedHubId, isAiming, mousePos, committedActions, showDebugPreview, maxPullDistance, myPlayerId]);

    const handleMouseDown = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if clicked an entity
        const clickedEntity = gameState.entities.find(ent => {
            const dist = Math.sqrt((ent.x - x) ** 2 + (ent.y - y) ** 2);
            return dist < 25;
        });

        if (clickedEntity && clickedEntity.owner === myPlayerId && clickedEntity.type === 'HUB') {
            onSelectHub(clickedEntity.id);
        } else if (onAimStart) {
            onAimStart(x, y);
        }
    };

    const handleMouseMove = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setMousePos({ x, y });
        if (isAiming && onAimUpdate) onAimUpdate(x, y);
    };

    const handleMouseUp = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (isAiming && onAimEnd) onAimEnd(x, y);
    };

    return (
        <div className="game-container" style={{ overflow: 'auto', background: '#1a1a1a', border: '2px solid #333', borderRadius: '8px' }}>
            <canvas
                ref={canvasRef}
                width={gameState.map.width}
                height={gameState.map.height}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                style={{ display: 'block', cursor: isAiming ? 'crosshair' : 'default' }}
            />
        </div>
    );
};

export default GameBoard;
