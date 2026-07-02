import { describe, it, expect, vi } from 'vitest';
import { GameState } from '../GameState.js';
import { drawGridFloor } from '../../client/src/components/canvas/GridFloorRenderer.js';
import { drawFogOfWar } from '../../client/src/components/canvas/FogOfWarRenderer.js';
import { drawLinks } from '../../client/src/components/canvas/LinkRenderer.js';
import { drawEntities } from '../../client/src/components/canvas/EntityRenderer.js';
import { drawUIOverlay } from '../../client/src/components/canvas/UIOverlayRenderer.js';

// Mock high-performance Canvas context
const createMockContext = () => {
    const baseCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        scale: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        arc: vi.fn(),
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        setLineDash: vi.fn(),
        createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        drawImage: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn(() => ({ width: 10 })),
        rect: vi.fn(),
        clip: vi.fn(),
        setTransform: vi.fn(),
        closePath: vi.fn(),
        strokeRect: vi.fn(),
        strokeStyle: '#000',
        fillStyle: '#000',
        lineWidth: 1,
        globalAlpha: 1.0,
        lineDashOffset: 0,
        shadowColor: 'transparent',
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        font: '10px sans-serif',
        textAlign: 'left',
        textBaseline: 'alphabetic'
    };

    return new Proxy(baseCtx, {
        get(target, prop) {
            if (prop in target) {
                return target[prop];
            }
            // Fallback for any standard 2D canvas method called
            return vi.fn();
        }
    });
};

describe('High-Load Performance Benchmark', () => {
    it('runs the high-load simulation and measures performance', () => {
        // Intercept document.createElement('canvas') for Fog of War renderer
        const originalCreateElement = document.createElement;
        const mockCanvasCtx = createMockContext();
        document.createElement = (tagName) => {
            if (tagName === 'canvas') {
                return {
                    width: 0,
                    height: 0,
                    getContext: () => mockCanvasCtx
                };
            }
            return originalCreateElement.call(document, tagName);
        };

        // 1. Helper to recreate the benchmark state for each run
        const createBenchmarkState = () => {
            const game = new GameState();
            game.initializeGame(['p1', 'p2']);
            game.map.width = 2000;
            game.map.height = 2000;

            // Stub checkLinkIntegrity to prevent entities from decaying during benchmarking
            game.checkLinkIntegrity = () => {};

            // Clear Map obstacles so links and projectiles do not break/drown during benchmarking
            game.map.lakes = [];
            game.map.mountains = [];
            game.map.resources = Array.from({ length: 15 }, (_, i) => ({ x: 100 + i * 120, y: 150 + i * 110, radius: 8, value: 5 }));

            // Add 20 Hubs (10 owned by p1, 10 owned by p2)
            const hubs = [];
            for (let i = 0; i < 10; i++) {
                hubs.push(game.addEntity({
                    type: 'HUB',
                    x: 100 + i * 180,
                    y: 200 + (i % 2) * 400,
                    owner: 'p1',
                    fuel: 100,
                    hp: 100,
                    deployed: true,
                    isStarter: i === 0
                }));
                hubs.push(game.addEntity({
                    type: 'HUB',
                    x: 100 + i * 180,
                    y: 1200 + (i % 2) * 400,
                    owner: 'p2',
                    fuel: 100,
                    hp: 100,
                    deployed: true,
                    isStarter: i === 0
                }));
            }

            // Add 40 active links
            for (let i = 0; i < 20; i++) {
                game.addLink(hubs[(i * 2) % hubs.length].id, hubs[(i * 2 + 1) % hubs.length].id, 'p1');
                game.addLink(hubs[(i * 2 + 1) % hubs.length].id, hubs[(i * 2 + 2) % hubs.length].id, 'p2');
            }

            // Add 10 Nuclear Hazard Areas
            for (let i = 0; i < 10; i++) {
                game.addEntity({
                    type: 'EXPLOSION_HAZARD',
                    x: 300 + i * 150,
                    y: 500 + i * 100,
                    owner: i % 2 === 0 ? 'p1' : 'p2',
                    expiresTurn: game.turn + 5,
                    hp: 999,
                    deployed: true,
                    isHazard: true
                });
            }

            // Add 30 projectiles flying in toroidal space
            for (let i = 0; i < 30; i++) {
                const types = ['WEAPON', 'NAPALM', 'CLUSTER_BOMB', 'HOMING_MISSILE'];
                const itemType = types[i % types.length];
                game.addEntity({
                    type: 'PROJECTILE',
                    itemType,
                    owner: i % 2 === 0 ? 'p1' : 'p2',
                    x: 100 + i * 50,
                    y: 100 + i * 50,
                    currX: 100 + i * 50,
                    currY: 100 + i * 50,
                    startX: i * 50,
                    startY: i * 50,
                    intendedDx: 400,
                    intendedDy: 400,
                    arrivalTick: 999,
                    active: true,
                    hp: 5
                });
            }
            return game;
        };

        // 2. Warm up JIT Compiler before measuring
        for (let w = 0; w < 3; w++) {
            const warmupGame = createBenchmarkState();
            warmupGame.resolveTurn({ p1: [], p2: [] });
        }

        // --- SUB-TICK PHYSICS BENCHMARK ---
        const resolutionRuns = 5;
        const resolutionTimes = [];
        let snapshots;
        let game;

        for (let r = 0; r < resolutionRuns; r++) {
            game = createBenchmarkState();
            const startResolution = performance.now();
            snapshots = game.resolveTurn({ p1: [], p2: [] });
            const endResolution = performance.now();
            resolutionTimes.push(endResolution - startResolution);
        }

        resolutionTimes.sort((a, b) => a - b);
        const durationResolution = resolutionTimes[Math.floor(resolutionRuns / 2)]; // Median resolution time to filter contention spikes

        const subTickSnaps = snapshots.filter((s) => s.type === 'ROUND_SUB');
        const numSubTicks = subTickSnaps.length || 200;
        const avgSubTickRate = durationResolution / numSubTicks;

        // --- CANVAS RENDERING BENCHMARK ---
        const mockCtx = createMockContext();
        const viewBounds = { viewL: 0, viewR: 1920, viewT: 0, viewB: 1080 };
        const visualEntities = {};
        game.entities.forEach((ent) => {
            visualEntities[ent.id] = { ...ent, x: ent.x, y: ent.y };
        });
        const visualLinks = {};
        game.links.forEach((link, idx) => {
            visualLinks[`link-${idx}`] = { ...link };
        });

        const committedActions = [];
        const maxPullDistance = 300;
        const HUB_RADIUS = 30;

        const renderRuns = 100;
        const renderTimes = [];

        for (let r = 0; r < renderRuns; r++) {
            const startRender = performance.now();
            
            drawGridFloor(mockCtx, game.map, viewBounds, 0, 0);
            
            drawLinks(mockCtx, visualLinks, visualEntities, game.players, viewBounds, game.map.width, game.map.height, 0, 0, () => true);
            
            drawEntities(mockCtx, visualEntities, game, 'p1', viewBounds, 0, 0, () => true, null, null, false, { x: 0, y: 0 }, maxPullDistance, null, false, committedActions);
            
            drawFogOfWar(mockCtx, { current: null }, 1920, 1080, 1.0, { x: 0, y: 0 }, game.map.width, game.map.height, viewBounds, game.entities, visualEntities, 'p1');
            
            drawUIOverlay(mockCtx, visualEntities, committedActions, maxPullDistance, HUB_RADIUS);
            
            const endRender = performance.now();
            renderTimes.push(endRender - startRender);
        }

        renderTimes.sort((a, b) => a - b);
        const totalRenderTime = renderTimes.reduce((s, t) => s + t, 0);
        const avgRenderTime = totalRenderTime / renderRuns;
        const minRenderTime = renderTimes[0];
        const maxRenderTime = renderTimes[renderTimes.length - 1];
        const medianRenderTime = renderTimes[Math.floor(renderRuns / 2)];
        const p95RenderTime = renderTimes[Math.floor(renderRuns * 0.95)];
        const p99RenderTime = renderTimes[Math.floor(renderRuns * 0.99)];

        // Restore createElement
        document.createElement = originalCreateElement;

        // Print elegant performance summary table
        console.log('\n======================================================');
        console.log('   HIGH-LOAD SIMULATION PERFORMANCE REPORT (100+ ENTITIES)');
        console.log('======================================================');
        console.log(`- Active Entities:    ${game.entities.length}`);
        console.log(`- Active Links:       ${game.links.length}`);
        console.log(`- Snapshots Gen:      ${snapshots.length}`);
        console.log(`- Turn Resolution:    ${durationResolution.toFixed(2)} ms (median of ${resolutionRuns} runs)`);
        console.log(`- Avg Sub-Tick Rate:  ${avgSubTickRate.toFixed(4)} ms/sub-tick`);
        console.log('------------------------------------------------------');
        console.log('   MOCK CANVAS RENDER TIME (100 runs):');
        console.log('------------------------------------------------------');
        console.log(`- Median Frame:       ${medianRenderTime.toFixed(2)} ms (${(1000 / medianRenderTime).toFixed(1)} FPS)`);
        console.log(`- Average Frame:      ${avgRenderTime.toFixed(2)} ms (${(1000 / avgRenderTime).toFixed(1)} FPS)`);
        console.log(`- Minimum Frame:      ${minRenderTime.toFixed(2)} ms`);
        console.log(`- Maximum Frame:      ${maxRenderTime.toFixed(2)} ms`);
        console.log(`- P95 Frame:          ${p95RenderTime.toFixed(2)} ms`);
        console.log(`- P99 Frame:          ${p99RenderTime.toFixed(2)} ms`);
        console.log('======================================================\n');

        // Performance budgets (must meet at least "Good" ranking thresholds)
        expect(avgSubTickRate).toBeLessThanOrEqual(0.10);  // Fail if sub-tick resolution is slower than 0.10 ms (Good rating threshold)
        expect(medianRenderTime).toBeLessThanOrEqual(8.3); // Fail if median canvas rendering is slower than 8.3 ms (120+ FPS/Good rating threshold)
    });
});
