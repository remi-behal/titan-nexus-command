import { useState, useRef, useEffect, useCallback } from 'react';
import * as TorusMath from '../../../shared/utils/TorusMath.js';
import { audioManager } from '../utils/AudioManager';

/**
 * useCameraControls is a custom React hook that extracts camera panning, pinch-to-zoom,
 * and mouse-to-game coordinate conversions from the main canvas component.
 */
export function useCameraControls({
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
}) {
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef({ x: 0, y: 0 });
    const mouseDownPosRef = useRef({ x: 0, y: 0 });
    const activePointersRef = useRef(new Map());
    const lastPinchDistRef = useRef(0);

    // Helper: Calculate game coordinates from mouse event
    const getGameCoords = useCallback(
        (e) => {
            // Handles MouseEvent and PointerEvent
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

            const x = ((e.clientX - rect.left - offsetX) * scale) / zoom + cameraOffset.x;
            const y = ((e.clientY - rect.top - offsetY) * scale) / zoom + cameraOffset.y;

            return {
                x: TorusMath.wrapX(x, gameState.map.width),
                y: TorusMath.wrapY(y, gameState.map.height)
            };
        },
        [cameraOffset, zoom, gameState.map.width, gameState.map.height, canvasRef]
    );

    const getScreenCoords = useCallback(
        (gameX, gameY) => {
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
            const primaryX = (dx * zoom) / scale + rect.left + offsetX;
            const primaryY = (dy * zoom) / scale + rect.top + offsetY;

            // Account for 3x3 toroidal tiling
            const mapPixelW = (gameState.map.width * zoom) / scale;
            const mapPixelH = (gameState.map.height * zoom) / scale;

            const xInstances = [primaryX - mapPixelW, primaryX, primaryX + mapPixelW];
            const yInstances = [primaryY - mapPixelH, primaryY, primaryY + mapPixelH];

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
        },
        [cameraOffset, zoom, gameState.map.width, gameState.map.height, canvasRef]
    );

    useEffect(() => {
        const handleGlobalMouseMove = (e) => {
            activePointersRef.current.set(e.pointerId, {
                x: e.clientX,
                y: e.clientY,
                button: e.button
            });

            // Always track mouse coordinates for hover effects
            const { x, y } = getGameCoords(e);
            setMousePos({ x, y });

            if (isAiming) {
                onAimUpdate(x, y);
            } else if (activePointersRef.current.size === 2) {
                // Pinch-to-Zoom logic
                const pointers = Array.from(activePointersRef.current.values());
                const dist = Math.hypot(
                    pointers[0].x - pointers[1].x,
                    pointers[0].y - pointers[1].y
                );

                if (lastPinchDistRef.current > 0) {
                    const zoomSpeed = 0.005;
                    const delta = (dist - lastPinchDistRef.current) * zoomSpeed;

                    setZoom((prevZoom) => {
                        const newZoom = Math.max(1.0, Math.min(3.0, prevZoom + delta));
                        if (newZoom === prevZoom) return prevZoom;

                        const midX = (pointers[0].x + pointers[1].x) / 2;
                        const midY = (pointers[0].y + pointers[1].y) / 2;

                        const canvas = canvasRef.current;
                        if (!canvas) return prevZoom;
                        const rect = canvas.getBoundingClientRect();
                        const localX = midX - rect.left;
                        const localY = midY - rect.top;

                        const mapW = gameState.map.width;
                        const mapH = gameState.map.height;

                        setCameraOffset((prevOffset) => ({
                            x: (prevOffset.x + localX * (1 / prevZoom - 1 / newZoom) + mapW) % mapW,
                            y: (prevOffset.y + localY * (1 / prevZoom - 1 / newZoom) + mapH) % mapH
                        }));

                        return newZoom;
                    });
                }
                lastPinchDistRef.current = dist;
                panStartRef.current = {
                    x: (pointers[0].x + pointers[1].x) / 2,
                    y: (pointers[0].y + pointers[1].y) / 2
                };
            } else if (isPanning) {
                const dx = e.clientX - panStartRef.current.x;
                const dy = e.clientY - panStartRef.current.y;

                const canvas = canvasRef.current;
                if (!canvas) return;
                const rect = canvas.getBoundingClientRect();
                if (!rect.width || !rect.height) return;

                const scale = canvas.width / rect.width;
                if (isNaN(scale) || !isFinite(scale)) return;

                setCameraOffset((prev) => ({
                    x:
                        (prev.x -
                            (((dx * scale) / zoom) % gameState.map.width) +
                            gameState.map.width) %
                        gameState.map.width,
                    y:
                        (prev.y -
                            (((dy * scale) / zoom) % gameState.map.height) +
                            gameState.map.height) %
                        gameState.map.height
                }));

                panStartRef.current = { x: e.clientX, y: e.clientY };
            }
        };

        const handleGlobalMouseUp = (e) => {
            activePointersRef.current.delete(e.pointerId);
            if (activePointersRef.current.size < 2) {
                lastPinchDistRef.current = 0;
            }

            if (isAiming) {
                const { x, y } = getGameCoords(e);
                onAimEnd(x, y);
            }

            if (isPanning) {
                const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
                const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
                const isShortClick = dx < 5 && dy < 5;

                if (isShortClick && !isResolving) {
                    const { x: gameX, y: gameY } = getGameCoords(e);

                    // Check for hub click
                    const clickedHub = gameState.entities.find((ent) => {
                        if (ent.type !== 'HUB') return false;
                        const d = TorusMath.getToroidalDistance(
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
                        audioManager.playTerminalSelect();
                        onSelectHub(clickedHub.id);
                    } else {
                        onSelectHub(null);
                    }
                }
            }

            setIsPanning(false);
        };

        window.addEventListener('pointermove', handleGlobalMouseMove);
        window.addEventListener('pointerup', handleGlobalMouseUp);

        return () => {
            window.removeEventListener('pointermove', handleGlobalMouseMove);
            window.removeEventListener('pointerup', handleGlobalMouseUp);
        };
    }, [
        isAiming,
        isPanning,
        gameState.map.width,
        gameState.map.height,
        gameState.entities,
        getGameCoords,
        onAimEnd,
        onAimUpdate,
        onSelectHub,
        HUB_RADIUS,
        myPlayerId,
        setCameraOffset,
        isResolving,
        zoom,
        setZoom,
        minZoom,
        canvasRef
    ]);

    const handlePointerDown = (e) => {
        const { x, y } = getGameCoords(e);

        if (!isResolving && launchMode && selectedHubId) {
            const currentHub = gameState.entities.find((ent) => ent.id === selectedHubId);
            if (currentHub && currentHub.owner === myPlayerId) {
                const d = TorusMath.getToroidalDistance(
                    currentHub.x,
                    currentHub.y,
                    x,
                    y,
                    gameState.map.width,
                    gameState.map.height
                );
                const isInsideRing = d < SLING_RING_RADIUS;

                if (isInsideRing) {
                    onAimStart(currentHub.id, x, y);
                    return;
                }
            }
            return;
        }

        if (e.button === 0 || e.button === 1) {
            setIsPanning(true);
            panStartRef.current = { x: e.clientX, y: e.clientY };
            mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
        }

        activePointersRef.current.set(e.pointerId, {
            x: e.clientX,
            y: e.clientY,
            button: e.button
        });
        if (activePointersRef.current.size === 2) {
            const pointers = Array.from(activePointersRef.current.values());
            lastPinchDistRef.current = Math.hypot(
                pointers[0].x - pointers[1].x,
                pointers[0].y - pointers[1].y
            );
            setIsPanning(false);
        }
    };

    return {
        mousePos,
        setMousePos,
        isPanning,
        setIsPanning,
        panStartRef,
        mouseDownPosRef,
        activePointersRef,
        lastPinchDistRef,
        getGameCoords,
        getScreenCoords,
        handlePointerDown
    };
}
