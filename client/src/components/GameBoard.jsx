import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { GameState } from '../../../shared/GameState.js';
import { ENTITY_STATS, GLOBAL_STATS } from '../../../shared/constants/EntityStats.js';
import { VISUAL_STATS } from '../constants/VisualStats.js';



import { SHAPES } from '../constants/ShapeDefinitions.js';

import * as TorusMath from '../../../shared/utils/TorusMath.js';
import { useCameraControls } from '../hooks/useCameraControls';
import { useVisualInterpolation } from '../hooks/useVisualInterpolation.js';
import { drawGridFloor } from './canvas/GridFloorRenderer.js';
import { drawFogOfWar } from './canvas/FogOfWarRenderer.js';
import { drawLinks } from './canvas/LinkRenderer.js';
import { drawEntities } from './canvas/EntityRenderer.js';
import { drawUIOverlay } from './canvas/UIOverlayRenderer.js';

/**
 * GameBoard Component
 *
 * Takes the 'gameState' and renders it using HTML5 Canvas.
 * Implements client-side interpolation (Lerp) for smooth movement.
 */
// --- Toroidal Utility Helpers (Defined outside to avoid stale closures) ---





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

    const HUB_RADIUS = ENTITY_STATS.HUB.size;
    const SLING_RING_RADIUS = GLOBAL_STATS.SLING_RING_RADIUS;
    const RING_INTERACTION_BUFFER = GLOBAL_STATS.RING_INTERACTION_BUFFER;

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

    const { visualEntities, visualLinks, updateInterpolation } = useVisualInterpolation();
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
                const { isInVision } = updateInterpolation(currentGameState, myPlayerId);

                // 2. CLEAR CANVAS
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                // -----------------------------------------------------------------
                // 3x3 TILED RENDERING LOOP
                // This ensures objects near edges appear on the opposite side.
                // -----------------------------------------------------------------

                // Calculate visible viewport bounds in game coordinates for culling
                const canvasW = canvas.width;
                const canvasH = canvas.height;
                const viewportWidth = canvasW / zoom;
                const viewportHeight = canvasH / zoom;
                const viewL = cameraOffset.x;
                const viewT = cameraOffset.y;
                const viewR = viewL + viewportWidth;
                const viewB = viewT + viewportHeight;
                const viewBounds = { viewL, viewR, viewT, viewB };

                ctx.save();
                // Apply zoom and camera offset
                ctx.scale(zoom, zoom);
                ctx.translate(-cameraOffset.x, -cameraOffset.y);

                // Get player object and their color
                const player = currentGameState.players[myPlayerId];
                const playerColor = player ? player.color : 'hsl(120, 70%, 50%)';
                // Dim the player's HSL color to 4% lightness for a gorgeous dark themed floor
                const floorColor = playerColor.startsWith('hsl')
                    ? playerColor.replace('50%', '5%')
                    : '#0c0d12'; // Fallback
                // 2. BACKGROUND
                ctx.fillStyle = floorColor;
                ctx.fillRect(-mapW, -mapH, mapW * 3, mapH * 3);

                for (let offsetOffsetX = -mapW; offsetOffsetX <= mapW; offsetOffsetX += mapW) {
                    for (let offsetOffsetY = -mapH; offsetOffsetY <= mapH; offsetOffsetY += mapH) {
                        const tileL = offsetOffsetX;
                        const tileT = offsetOffsetY;
                        const tileR = offsetOffsetX + mapW;
                        const tileB = offsetOffsetY + mapH;

                        const pad = 800; 
                        const isVisible = !(tileR + pad < viewL || tileL - pad > viewR || tileB + pad < viewT || tileT - pad > viewB);
                        if (!isVisible) continue;

                        ctx.save();
                        ctx.translate(offsetOffsetX, offsetOffsetY);



                        drawGridFloor(ctx, currentGameState.map, viewBounds, offsetOffsetX, offsetOffsetY);
                        drawLinks(ctx, visualLinks.current, visualEntities.current, currentGameState.players, viewBounds, mapW, mapH, offsetOffsetX, offsetOffsetY, isInVision);

                        ctx.restore();
                    }
                }
                ctx.restore();


                // -----------------------------------------------------------------
                // 7. FOG OF WAR OVERLAY
                const fogViewBounds = { viewL, viewR, viewT, viewB };
                drawFogOfWar(
                    ctx, 
                    fogCanvasRef, 
                    canvas.width, 
                    canvas.height, 
                    zoom, 
                    cameraOffset, 
                    mapW, 
                    mapH, 
                    fogViewBounds, 
                    currentGameState.entities, 
                    visualEntities.current, 
                    myPlayerId
                );


                // 8. FOREGROUND & UI (Entities, Highlights, Aiming)
                // -----------------------------------------------------------------
                ctx.save(); // Balance with the final restore() at the end of updateAndDraw
                ctx.scale(zoom, zoom);
                ctx.translate(-cameraOffset.x, -cameraOffset.y);

                for (let offsetOffsetX = -mapW; offsetOffsetX <= mapW; offsetOffsetX += mapW) {
                    for (let offsetOffsetY = -mapH; offsetOffsetY <= mapH; offsetOffsetY += mapH) {
                        // TILE CULLING: Check if this tile instance overlaps the viewport
                        const tileL = offsetOffsetX;
                        const tileT = offsetOffsetY;
                        const tileR = offsetOffsetX + mapW;
                        const tileB = offsetOffsetY + mapH;

                        const pad = 800; // Account for large visual effects crossing tile boundaries
                        const isTileVisible = !(tileR + pad < viewL || tileL - pad > viewR || tileB + pad < viewT || tileT - pad > viewB);
                        if (!isTileVisible) continue;

                        ctx.save();
                        ctx.translate(offsetOffsetX, offsetOffsetY);

                        // 5. DRAW ENTITIES
                        drawEntities(
                            ctx,
                            visualEntities.current,
                            currentGameState,
                            myPlayerId,
                            viewBounds,
                            offsetOffsetX,
                            offsetOffsetY,
                            isInVision,
                            selectedHubId,
                            launchMode,
                            isAiming,
                            mousePos,
                            maxPullDistance,
                            selectedItemType,
                            showDebugPreview,
                            committedActions
                        );

                        // 6. DRAW UI OVERLAY
                        drawUIOverlay(
                            ctx,
                            visualEntities.current,
                            committedActions,
                            maxPullDistance,
                            HUB_RADIUS
                        );


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
        setCameraOffset,
        zoom,
        HUB_RADIUS,
        SLING_RING_RADIUS
    ]);

    useImperativeHandle(ref, () => ({
        getScreenCoords,
        getGameCoords
    }));

    return (
        <div
            className="game-container"
            style={{
                overflow: 'hidden'
            }}
        >
            <canvas
                ref={canvasRef}
                width={gameState.map.width}
                height={gameState.map.height}
                onPointerDown={handlePointerDown}
                style={{
                    display: 'block',
                    cursor: isAiming ? 'crosshair' : isPanning ? 'grabbing' : 'grab',
                    width: '100%',
                    maxHeight: '100%',
                    objectFit: 'fill'
                }}
            />
        </div>
    );
});

export default GameBoard;
