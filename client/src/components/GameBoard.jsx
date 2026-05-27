import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { ENTITY_STATS, GLOBAL_STATS } from '../../../shared/constants/EntityStats.js';
import { useCameraControls } from '../hooks/useCameraControls';
import { useVisualInterpolation } from '../hooks/useVisualInterpolation';
import { drawGridFloor } from './canvas/GridFloorRenderer';
import { drawLinks } from './canvas/LinkRenderer';
import { drawEntities } from './canvas/EntityRenderer';
import { drawUIOverlays } from './canvas/UIOverlayRenderer';

/**
 * GameBoard Component
 *
 * Takes the 'gameState' and renders it using HTML5 Canvas.
 * Delegates camera controls, interpolation, and individual visual layers to sub-modules.
 */
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
    isResolving,
    cameraOffset,
    setCameraOffset,
    zoom,
    setZoom,
    minZoom
}, ref) => {
    const canvasRef = useRef(null);
    const fogCanvasRef = useRef(null);

    const HUB_RADIUS = ENTITY_STATS.HUB.size;
    const SLING_RING_RADIUS = GLOBAL_STATS.SLING_RING_RADIUS;

    // Camera and pointer panning/dragging hook
    const {
        mousePos,
        isPanning,
        getGameCoords,
        getScreenCoords,
        handlePointerDown
    } = useCameraControls({
        canvasRef,
        gameState,
        myPlayerId,
        selectedHubId,
        launchMode,
        isAiming,
        onAimStart,
        onAimUpdate,
        onAimEnd,
        onSelectHub,
        isResolving,
        cameraOffset,
        setCameraOffset,
        zoom,
        setZoom,
        minZoom,
        HUB_RADIUS,
        SLING_RING_RADIUS
    });

    // Interpolation and Fog of War/Ghost state management hook
    const { updateInterpolation, visualEntities, visualLinks } = useVisualInterpolation();

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

    // Vector pull arrow helper color gradient
    const getStrengthColor = (ratio) => {
        let r, g = 0;
        const b = 0;
        if (ratio < 0.5) {
            const segmentRatio = ratio * 2;
            r = Math.floor(255 * segmentRatio);
            g = Math.floor(255 - 90 * segmentRatio);
        } else {
            const segmentRatio = (ratio - 0.5) * 2;
            r = 255;
            g = Math.floor(165 * (1 - segmentRatio));
        }
        return `rgb(${r}, ${g}, ${b})`;
    };

    useImperativeHandle(ref, () => ({
        getScreenCoords
    }));

    // Main 60fps Animation Draw Loop
    useEffect(() => {
        let animationFrameId;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const updateAndDraw = () => {
            try {
                const props = propsRef.current;
                const {
                    gameState: currentGameState,
                    myPlayerId: pid,
                    cameraOffset: rawCameraOffset,
                    zoom: activeZoom
                } = props;

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
                const LERP_FACTOR = 0.3;

                // 1. LERP VISUAL SNAPSHOT & PROCESS GHOSTS
                const { visualEntities: vEntities, visualLinks: vLinks, isInVision } = updateInterpolation(
                    currentGameState,
                    pid,
                    LERP_FACTOR
                );

                // 2. CLEAR CANVAS
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                // Calculate visible viewport bounds in game coordinates for culling
                const canvasW = canvas.width;
                const canvasH = canvas.height;
                const viewportWidth = canvasW / activeZoom;
                const viewportHeight = canvasH / activeZoom;
                const viewL = cameraOffset.x;
                const viewT = cameraOffset.y;
                const viewR = viewL + viewportWidth;
                const viewB = viewT + viewportHeight;
                const viewBounds = { viewL, viewT, viewR, viewB };

                ctx.save();
                // Apply camera scaling and transforms
                ctx.scale(activeZoom, activeZoom);
                ctx.translate(-cameraOffset.x, -cameraOffset.y);

                const player = currentGameState.players[pid];
                const playerColor = player ? player.color : 'hsl(120, 70%, 50%)';
                const floorColor = playerColor.startsWith('hsl') ? playerColor.replace('50%', '5%') : '#0c0d12';

                // Tiled floor paint
                ctx.fillStyle = floorColor;
                ctx.fillRect(-mapW, -mapH, mapW * 3, mapH * 3);

                // 3. DRAW BACKGROUND LAYERS (Grid floor and Links)
                for (let ox = -mapW; ox <= mapW; ox += mapW) {
                    for (let oy = -mapH; oy <= mapH; oy += mapH) {
                        const tileL = ox;
                        const tileT = oy;
                        const tileR = ox + mapW;
                        const tileB = oy + mapH;
                        const pad = 800; // Account for large visual effects crossing boundaries

                        if (tileR + pad < viewL || tileL - pad > viewR || tileB + pad < viewT || tileT - pad > viewB) continue;

                        ctx.save();
                        ctx.translate(ox, oy);

                        // Draw background hazards (lakes, mountains, craters, energy nodes)
                        drawGridFloor(ctx, currentGameState, pid, viewBounds, ox, oy);

                        // Draw cables and link pipelines
                        drawLinks(ctx, currentGameState, vEntities, vLinks, isInVision, viewBounds, mapW, mapH, ox, oy);

                        ctx.restore();
                    }
                }
                ctx.restore();

                // 4. DRAW SOLID FOG OF WAR MASK
                if (pid && pid !== 'spectator') {
                    if (!fogCanvasRef.current) {
                        fogCanvasRef.current = document.createElement('canvas');
                    }
                    const fogCanvas = fogCanvasRef.current;
                    if (fogCanvas.width !== canvas.width || fogCanvas.height !== canvas.height) {
                        fogCanvas.width = canvas.width;
                        fogCanvas.height = canvas.height;
                    }
                    const fctx = fogCanvas.getContext('2d');

                    fctx.setTransform(1, 0, 0, 1, 0, 0);
                    fctx.clearRect(0, 0, fogCanvas.width, fogCanvas.height);
                    fctx.globalCompositeOperation = 'source-over';
                    fctx.fillStyle = 'rgba(0, 0, 0, 1)';
                    fctx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);

                    // Composite destination-out to punch vision holes
                    fctx.globalCompositeOperation = 'destination-out';
                    fctx.fillStyle = '#ffffff';
                    fctx.scale(activeZoom, activeZoom);
                    fctx.translate(-cameraOffset.x, -cameraOffset.y);

                    for (let ox = -mapW; ox <= mapW; ox += mapW) {
                        for (let oy = -mapH; oy <= mapH; oy += mapH) {
                            const tileR = ox + mapW;
                            const tileL = ox;
                            const tileB = oy + mapH;
                            const tileT = oy;
                            const pad = 800;

                            if (tileR + pad < viewL || tileL - pad > viewR || tileB + pad < viewT || tileT - pad > viewB) continue;

                            fctx.save();
                            fctx.translate(ox, oy);

                            currentGameState.entities.forEach((entity) => {
                                const stats = ENTITY_STATS[entity.itemType || entity.type];
                                const cullingRadius = Math.max(stats?.vision || 0, stats?.size || 20);
                                if (entity.x + ox + cullingRadius < viewL || 
                                    entity.x + ox - cullingRadius > viewR ||
                                    entity.y + oy + cullingRadius < viewT || 
                                    entity.y + oy - cullingRadius > viewB) return;

                                if (entity.owner === pid || (stats?.damageFull !== undefined && entity.owner === pid)) {
                                    const radius = stats?.vision || 0;
                                    if (radius > 0) {
                                        const viz = vEntities[entity.id] || entity;
                                        fctx.beginPath();
                                        if (entity.itemType === 'HOMING_MISSILE') {
                                            const rad = ((viz.currentAngle || 0) * Math.PI) / 180;
                                            const halfCone = ((stats.searchCone || 60) * (Math.PI / 180)) / 2;
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

                    // Composite back onto gameboard canvas
                    ctx.save();
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.drawImage(fogCanvas, 0, 0);
                    ctx.restore();
                }

                // 5. DRAW FOREGROUND LAYERS (Entities and UI Overlays)
                ctx.save();
                ctx.scale(activeZoom, activeZoom);
                ctx.translate(-cameraOffset.x, -cameraOffset.y);

                for (let ox = -mapW; ox <= mapW; ox += mapW) {
                    for (let oy = -mapH; oy <= mapH; oy += mapH) {
                        const tileR = ox + mapW;
                        const tileL = ox;
                        const tileB = oy + mapH;
                        const tileT = oy;
                        const pad = 800;

                        if (tileR + pad < viewL || tileL - pad > viewR || tileB + pad < viewT || tileT - pad > viewB) continue;

                        ctx.save();
                        ctx.translate(ox, oy);

                        // Draw active nodes and weapon entities
                        drawEntities(ctx, currentGameState, vEntities, pid, viewBounds, ox, oy);

                        ctx.restore();
                    }
                }

                // Draw aiming pulling overlays and locked slingshot lines
                const activeHub = props.selectedHubId ? currentGameState.entities.find((e) => e.id === props.selectedHubId) : null;
                const state = { activeHub, HUB_RADIUS, SLING_RING_RADIUS };
                drawUIOverlays(ctx, props, state, getStrengthColor, getScreenCoords);

                ctx.restore();

                animationFrameId = requestAnimationFrame(updateAndDraw);
            } catch (err) {
                console.error('Error rendering GameBoard:', err);
                animationFrameId = requestAnimationFrame(updateAndDraw);
            }
        };

        animationFrameId = requestAnimationFrame(updateAndDraw);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [updateInterpolation]);

    return (
        <canvas
            ref={canvasRef}
            width={800}
            height={600}
            style={{ display: 'block', width: '100%', height: '100%', cursor: isAiming ? 'crosshair' : isPanning ? 'grabbing' : 'default' }}
            onPointerDown={handlePointerDown}
        />
    );
});

GameBoard.displayName = 'GameBoard';

export default GameBoard;
