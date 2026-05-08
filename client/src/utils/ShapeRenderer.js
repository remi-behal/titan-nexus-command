/**
 * ShapeRenderer.js
 * 
 * Standardized drawing engine for normalized shapes.
 */

import { SHAPE_TYPES, SHAPES } from '../constants/ShapeDefinitions.js';

export const drawShape = (ctx, x, y, shapeKey, radius, color, rotation = 0, isGhost = false, isWarning = false) => {
    const shape = SHAPES[shapeKey];
    if (!shape) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.strokeStyle = color;
    
    let alpha = isGhost ? 0.3 : 1.0;
    if (isWarning && !isGhost) {
        // High-frequency flicker for critical status
        const flicker = Math.sin(Date.now() / 40) > 0 ? 1.0 : 0.4;
        alpha *= flicker;
    }
    ctx.globalAlpha = alpha;
    
    // Phosphor Glow
    if (!isGhost) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
    }

    if (shape.type === SHAPE_TYPES.PATH) {
        const layers = isGhost ? 1 : (shape.layers || 1);
        
        for (let l = 1; l <= layers; l++) {
            const r = radius * (l / layers);
            ctx.lineWidth = l === layers ? 2 : 1;
            
            ctx.beginPath();
            shape.points.forEach(([px, py], i) => {
                if (i === 0) ctx.moveTo(px * r, py * r);
                else ctx.lineTo(px * r, py * r);
            });
            if (shape.closed) ctx.closePath();
            ctx.stroke();
        }

        // Internal Bracing (e.g. for Hubs)
        if (shape.bracing && !isGhost) {
            ctx.lineWidth = 1;
            ctx.beginPath();
            // Connect opposite points for symmetrical shapes
            for (let i = 0; i < Math.floor(shape.points.length / 2); i++) {
                const p1 = shape.points[i];
                const p2 = shape.points[i + Math.floor(shape.points.length / 2)];
                ctx.moveTo(p1[0] * radius, p1[1] * radius);
                ctx.lineTo(p2[0] * radius, p2[1] * radius);
            }
            ctx.stroke();
        }

        // Symbols (e.g. Nuke icon or Generator Core)
        if (!isGhost) {
            if (shape.symbol === 'RADIATION') {
                drawRadiationSymbol(ctx, radius * 0.6);
            } else if (shape.symbol === 'CORE') {
                drawCoreSymbol(ctx, radius * 0.6);
            }
        }
    }

    if (shape.type === SHAPE_TYPES.BURST) {
        ctx.lineWidth = 2;
        ctx.beginPath();
        const points = shape.points || 8;
        const jaggedness = shape.jaggedness || 0.5;
        
        for (let i = 0; i < points * 2; i++) {
            const a = (i * Math.PI) / points;
            const r = i % 2 === 0 ? radius : radius * jaggedness;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.stroke();
        
        if (!isGhost) {
            ctx.globalAlpha = 0.3;
            ctx.fill();
        }
    }

    ctx.restore();
};

export const drawField = (ctx, x, y, shapeKey, radius, color, isGhost = false, time = Date.now(), coneAngle = 60, currentAngle = 0) => {
    const shape = SHAPES[shapeKey];
    if (!shape) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.globalAlpha = isGhost ? 0.2 : 0.6;
    
    if (!isGhost) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
    }

    if (shape.drawType === 'ARC') {
        ctx.setLineDash(shape.dash || []);
        if (shape.pulse) {
            ctx.lineDashOffset = -time / 50;
            ctx.globalAlpha *= (0.7 + Math.sin(time / 200) * 0.3);
        }

        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Technical Ticks
        if (shape.showTicks && !isGhost) {
            ctx.setLineDash([]);
            for (let i = 0; i < 8; i++) {
                const a = (i * Math.PI * 2) / 8;
                ctx.beginPath();
                ctx.moveTo(Math.cos(a) * (radius - 5), Math.sin(a) * (radius - 5));
                ctx.lineTo(Math.cos(a) * (radius + 5), Math.sin(a) * (radius + 5));
                ctx.stroke();
            }
        }
    }

    if (shape.drawType === 'CONE') {
        const rad = (currentAngle * Math.PI) / 180;
        const halfCone = ((coneAngle) * (Math.PI / 180)) / 2;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, rad - halfCone, rad + halfCone);
        ctx.closePath();
        
        ctx.fillStyle = color;
        ctx.globalAlpha = shape.fillOpacity || 0.1;
        ctx.fill();
        
        ctx.globalAlpha = 0.4;
        ctx.stroke();
    }

    ctx.restore();
};

// Helper for complex internal symbols
function drawRadiationSymbol(ctx, r) {
    ctx.save();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const startA = (i * 120 - 30) * (Math.PI / 180);
        const endA = (i * 120 + 30) * (Math.PI / 180);
        ctx.arc(0, 0, r * 0.8, startA, endA);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();
}

/**
 * Draws a specialized generator core (circle with inner glow)
 */
function drawCoreSymbol(ctx, r) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    ctx.restore();
}
