import React, { useRef, useEffect, useState } from 'react';

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
    committedAction,
    showDebugPreview,
    maxPullDistance
}) => {
    const canvasRef = useRef(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const getStrengthColor = (ratio) => {
        // 0.0 (Green) to 0.5 (Orange/Yellow) to 1.0 (Red)
        if (ratio < 0.5) {
            const r = Math.floor(255 * (ratio * 2));
            return `rgb(${r}, 255, 0)`;
        } else {
            const g = Math.floor(255 * (1 - (ratio - 0.5) * 2));
            return `rgb(255, ${g}, 0)`;
        }
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

                // Draw the "Launch" indicator (opposite side)
                const launchAngle = Math.atan2(-dy, -dx);
                const arrowLen = 40 + (ratio * 40); // Arrow grows slightly with power
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
                ctx.lineTo(-10, -5);
                ctx.lineTo(-10, 5);
                ctx.closePath();
                ctx.fill();
                ctx.restore();

                // Draw PINPOINT PREVIEW (Only if enabled)
                if (showDebugPreview) {
                    const targetX = hub.x - dx;
                    const targetY = hub.y - dy;

                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.setLineDash([2, 5]);
                    ctx.beginPath();
                    ctx.moveTo(hub.x, hub.y);
                    ctx.lineTo(targetX, targetY);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                    ctx.beginPath();
                    ctx.arc(targetX, targetY, 10, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // 5. Draw Committed Action (Greyed out preview)
        if (committedAction) {
            ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
            ctx.strokeStyle = 'rgba(128, 128, 128, 0.5)';

            const rad = (committedAction.angle * Math.PI) / 180;
            const targetX = committedAction.sourceX + Math.cos(rad) * committedAction.distance;
            const targetY = committedAction.sourceY + Math.sin(rad) * committedAction.distance;

            ctx.beginPath();
            ctx.moveTo(committedAction.sourceX, committedAction.sourceY);
            ctx.lineTo(targetX, targetY);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(targetX, targetY, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillText("Committed", targetX, targetY - 15);
        }

    }, [gameState, selectedHubId, isAiming, mousePos, committedAction, showDebugPreview, maxPullDistance]);

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
