import { describe, it, expect } from 'vitest';
import { io as Client } from 'socket.io-client';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Full Cycle Integration - Real Life Scenarios', () => {
    it('should complete a 5-turn complex scenario', async () => {
        const serverPath = path.resolve(__dirname, 'index.js');
        const serverProcess = spawn('node', [serverPath], {
            env: {
                ...process.env,
                PORT: '3010',
                TURN_DURATION: '1',
                RESOLUTION_ROUND_DELAY: '200',
                RESOLUTION_SUB_TICK_DELAY: '10'
            },
            stdio: 'pipe'
        });

        const p1 = Client('http://localhost:3010');
        const p2 = Client('http://localhost:3010');

        let p1State = null;
        let p2State = null;
        let p1Resolution = false;

        let p1Id = 'player1'; // Fallback
        let p2Id = 'player2';

        p1.on('playerAssignment', (id) => {
            p1Id = id;
        });
        p2.on('playerAssignment', (id) => {
            p2Id = id;
        });

        p1.on('gameStateUpdate', (s) => {
            p1State = s;
        });
        p2.on('gameStateUpdate', (s) => {
            p2State = s;
        });
        p1.on('syncStatus', (s) => {
            // Silenced
        });
        p1.on('resolutionStatus', (s) => {
            p1Resolution = s.active;
        });

        const waitFor = (condition, timeout = 15000) => {
            return new Promise((resolve, reject) => {
                const start = Date.now();
                const interval = setInterval(() => {
                    if (condition()) {
                        clearInterval(interval);
                        resolve();
                    } else if (Date.now() - start > timeout) {
                        clearInterval(interval);
                        reject(new Error('Timeout waiting for condition'));
                    }
                }, 100);
            });
        };

        try {
            // 1. Wait for server
            await new Promise((resolve) => {
                serverProcess.stdout.on('data', (data) => {
                    const out = data.toString();
                    process.stdout.write('[Server Stdout]: ' + out);
                    if (out.includes('SERVER RUNNING')) resolve();
                });
                serverProcess.stderr.on('data', (data) => {
                    process.stderr.write('[Server Stderr]: ' + data.toString());
                });
            });

            // 2. Sequential connect - ensure p1 gets player1
            p1.connect();
            p1.emit('authenticate', 'p1-token-real-life');
            await new Promise((r) => setTimeout(r, 200));
            p1.emit('lobby:claimSeat', 0);
            await new Promise((r) => setTimeout(r, 200));
            p1.emit('lobby:ready', true);

            p2.connect();
            p2.emit('authenticate', 'p2-token-real-life');
            await new Promise((r) => setTimeout(r, 200));
            p2.emit('lobby:claimSeat', 1);
            await new Promise((r) => setTimeout(r, 200));
            p2.emit('lobby:ready', true);

            await waitFor(() => p1Id === 'player1', 10000);
            await waitFor(() => p2Id === 'player2', 10000);

            // 3. Wait for game to initialize and be in PLANNING Turn 1
            await waitFor(() => p1State && p1State.turn === 1 && p1State.phase === 'PLANNING', 10000);
            await waitFor(() => p2State && p2State.turn === 1 && p2State.phase === 'PLANNING', 10000);

            const hub1p1 = p1State.entities.find((e) => e.owner === p1Id);
            const hub1p2 = p2State.entities.find((e) => e.owner === p2Id);

            // --- TURN 1 ---
            const baseTurn = 1;
            p1.emit('submitActions', [
                { playerId: p1Id, sourceId: hub1p1.id, itemType: 'HUB', angle: 45, distance: 300 }
            ]);
            p2.emit('submitActions', [
                { playerId: p2Id, sourceId: hub1p2.id, itemType: 'HUB', angle: 225, distance: 300 }
            ]);

            await waitFor(() => p1State.turn === baseTurn + 1 && p1State.phase === 'PLANNING', 25000);

            // After resolution, each player should have 2 hubs (1 starter, 1 deployed)
            const p1HubsTurn2 = p1State.entities.filter(
                (e) => e.owner === p1Id && (e.itemType === 'HUB' || e.type === 'HUB')
            ).length;
            expect(p1HubsTurn2).toBe(2);

            // --- TURN 2 (baseTurn + 1) ---
            // Wait for EACH player to see their own 2 hubs in the planning phase
            await waitFor(() => {
                const hubs = p1State.entities.filter(
                    (e) => e.owner === p1Id && (e.itemType === 'HUB' || e.type === 'HUB')
                ).length;
                const phase = p1State.phase;
                return hubs === 2 && phase === 'PLANNING';
            }, 20000);

            const hub2p2 = p2State.entities.find((e) => e.owner === p2Id && e.id !== hub1p2.id);

            // P1 strikes at P2's new hub location
            const targetX = hub2p2.x;
            const targetY = hub2p2.y;
            // Use GameState helpers if possible, but we'll do it manually for reliability
            let dx = targetX - hub1p1.x;
            let dy = targetY - hub1p1.y;
            // Toroidal wrap handles
            if (dx > 1000) dx -= 2000;
            if (dx < -1000) dx += 2000;
            if (dy > 1000) dy -= 2000;
            if (dy < -1000) dy += 2000;

            const distToP2 = Math.sqrt(dx * dx + dy * dy);
            const angleToP2 = Math.atan2(dy, dx) * (180 / Math.PI);

            const pullDistance = 300 * Math.pow(distToP2 / 800, 1 / 1.6);

            p1.emit('submitActions', [
                {
                    playerId: p1Id,
                    sourceId: hub1p1.id,
                    itemType: 'SUPER_BOMB',
                    angle: angleToP2,
                    distance: pullDistance
                }
            ]);
            p2.emit('submitActions', [
                {
                    playerId: p2Id,
                    sourceId: hub2p2.id,
                    itemType: 'EXTRACTOR',
                    angle: 0,
                    distance: 50
                }
            ]);

            await waitFor(() => {
                return p1State?.turn === baseTurn + 2 && p1State.phase === 'PLANNING';
            }, 30000);
            expect(p1State.entities.find((e) => e.id === hub2p2.id)).toBeUndefined();

            // --- TURN 3 (baseTurn + 2) ---
            // Refresh hub2p1 from latest state
            const h2p1Latest = p1State.entities.find((e) => e.owner === p1Id && e.id !== hub1p1.id);

            p1.emit('submitActions', [
                {
                    playerId: p1Id,
                    sourceId: h2p1Latest.id,
                    itemType: 'EXTRACTOR',
                    angle: 0,
                    distance: 300
                }
            ]);

            await waitFor(() => p1State.turn === baseTurn + 3 && p1State.phase === 'PLANNING', 30000);

            const p1Extractors = p1State.entities.filter(
                (e) => e.owner === p1Id && (e.itemType === 'EXTRACTOR' || e.type === 'EXTRACTOR')
            );
            expect(p1Extractors.length).toBeGreaterThan(0);

            // --- TURN 4 (baseTurn + 3) ---
            p1.emit('submitActions', []);
            p2.emit('submitActions', []);
            await waitFor(() => p1State.turn === baseTurn + 4 && p1State.phase === 'PLANNING', 25000);

            // --- TURN 5 (baseTurn + 4) ---
            // Wait for resolution to BE ACTIVE
            await waitFor(() => p1Resolution === true, 25000);

            // This late submission should be rejected because phase is RESOLVING
            p1.emit('submitActions', [
                { playerId: p1Id, sourceId: hub1p1.id, itemType: 'WEAPON', angle: 0, distance: 100 }
            ]);

            await waitFor(() => p1State.turn === baseTurn + 5 && p1State.phase === 'PLANNING', 25000);
            expect(
                p1State.entities.find(
                    (e) => e.owner === p1Id && (e.itemType === 'WEAPON' || e.type === 'WEAPON')
                )
            ).toBeUndefined();

        } finally {
            p1?.disconnect();
            p2?.disconnect();
            serverProcess?.kill('SIGKILL');
            await new Promise((r) => setTimeout(r, 200));
        }
    }, 120000);
});
