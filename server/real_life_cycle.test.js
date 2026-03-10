
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
            env: { ...process.env, PORT: '3010', TURN_DURATION: '5' },
            stdio: 'pipe'
        });

        const p1 = Client('http://localhost:3010');
        const p2 = Client('http://localhost:3010');

        let p1State = null;
        let p2State = null;
        let p1Status = null;
        let p1Resolution = false;

        let p1Id = 'player1'; // Fallback
        let p2Id = 'player2';

        p1.on('playerAssignment', id => { console.log('p1 assigned:', id); p1Id = id; });
        p2.on('playerAssignment', id => { console.log('p2 assigned:', id); p2Id = id; });

        p1.on('connect', () => console.log('p1 connected'));
        p2.on('connect', () => console.log('p2 connected'));

        p1.on('gameStateUpdate', s => {
            p1State = s;
        });
        p2.on('gameStateUpdate', s => {
            p2State = s;
        });
        p1.on('syncStatus', s => {
            if (p1Id) {
                console.log(`p1 syncStatus: ${p1Id}=${s.lockedIn[p1Id]}`);
            }
            p1Status = s;
        });
        p1.on('resolutionStatus', s => {
            console.log(`p1 resolutionStatus: ${s.active}`);
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
            await new Promise(resolve => {
                serverProcess.stdout.on('data', data => {
                    const out = data.toString();
                    process.stdout.write(`[SERVER] ${out}`); // Pass through for debugging
                    if (out.includes('SERVER RUNNING')) resolve();
                });
                serverProcess.stderr.on('data', data => {
                    process.stderr.write(`[SERVER ERR] ${data.toString()}`);
                });
            });

            // 2. Sequential connect - ensure p1 gets player1
            console.log(`Connecting p1/p2 (ENV PORT: ${process.env.PORT || 3000})`);
            p1.connect();
            p1.emit('authenticate', 'p1-token-real-life');
            await waitFor(() => p1Id === 'player1', 5000);
            
            p2.connect();
            p2.emit('authenticate', 'p2-token-real-life');
            await waitFor(() => p2Id === 'player2', 5000);

            console.log('Waiting for initial state...');
            await waitFor(() => p1State && p1State.entities.some(e => e.owner === p1Id));
            await waitFor(() => p2State && p2State.entities.some(e => e.owner === p2Id));
            
            const hub1p1 = p1State.entities.find(e => e.owner === p1Id);
            const hub1p2 = p2State.entities.find(e => e.owner === p2Id);
            console.log(`Initial hubs: p1(${p1Id})=${hub1p1.id}, p2(${p2Id})=${hub1p2.id}`);

            // --- TURN 1 ---
            console.log('Turn 1: Launching Hubs');
            // submitActions ALREADY locks in the player and triggers resolution if both are done.
            // Calling passTurn immediately after would overwrite the actions with [].
            p1.emit('submitActions', [{ playerId: p1Id, sourceId: hub1p1.id, itemType: 'HUB', angle: 45, distance: 300 }]);
            p2.emit('submitActions', [{ playerId: p2Id, sourceId: hub1p2.id, itemType: 'HUB', angle: 225, distance: 300 }]);

            await waitFor(() => p1State.turn === 2 && p1State.phase === 'PLANNING', 25000);
            
            // After resolution, each player should have 2 hubs (1 starter, 1 deployed)
            const p1HubsTurn2 = p1State.entities.filter(e => e.owner === p1Id && (e.itemType === 'HUB' || e.type === 'HUB')).length;
            console.log(`Turn 2 Start: p1(${p1Id}) has ${p1HubsTurn2} hubs, p1 energy: ${p1State.players[p1Id].energy}`);
            expect(p1HubsTurn2).toBe(2);

            // --- TURN 2 ---
            console.log('Turn 2: Super Bomb vs Extractor');
            // Wait for EACH player to see their own 2 hubs in the planning phase
            await waitFor(() => {
                const hubs = p1State.entities.filter(e => e.owner === p1Id && (e.itemType === 'HUB' || e.type === 'HUB')).length;
                const phase = p1State.phase;
                if (Date.now() % 2000 < 200) console.log(`Turn 2 Sync: p1 has ${hubs} hubs, phase: ${phase}`);
                return hubs === 2 && phase === 'PLANNING';
            }, 20000);

            const hub2p1 = p1State.entities.find(e => e.owner === p1Id && e.id !== hub1p1.id);
            const hub2p2 = p2State.entities.find(e => e.owner === p2Id && e.id !== hub1p2.id);

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
            
            const distToP2 = Math.sqrt(dx*dx + dy*dy);
            const angleToP2 = Math.atan2(dy, dx) * (180 / Math.PI);

            console.log(`p1(${p1Id}) striking p2(${p2Id}) hub ${hub2p2.id} at (${Math.round(targetX)}, ${Math.round(targetY)})`);
            console.log(`Relative Vector: dx=${Math.round(dx)}, dy=${Math.round(dy)}, Angle=${angleToP2.toFixed(1)}, Dist=${distToP2.toFixed(1)}`);

            // To land at distToP2, we need to find the pull distance that results in that launch distance
            // d_launch = (pull / 300)^1.6 * 800  =>  pull = 300 * (d_launch / 800)^(1/1.6)
            const pullDistance = 300 * Math.pow(distToP2 / 800, 1/1.6);
            console.log(`Calculated Pull Distance for ${Math.round(distToP2)}px launch: ${pullDistance.toFixed(1)}`);

            p1.emit('submitActions', [{ playerId: p1Id, sourceId: hub1p1.id, itemType: 'SUPER_BOMB', angle: angleToP2, distance: pullDistance }]);
            p2.emit('submitActions', [{ playerId: p2Id, sourceId: hub2p2.id, itemType: 'EXTRACTOR', angle: 0, distance: 50 }]);

            await waitFor(() => {
                const turn = p1State?.turn;
                if (Date.now() % 2000 < 200) {
                    const h2 = p1State?.entities.find(e => e.id === hub2p2.id);
                    console.log(`Waiting for Turn 3... Current Turn: ${turn}, P2 Hub HP: ${h2?.hp}`);
                }
                return turn === 3 && p1State.phase === 'PLANNING';
            }, 30000);
            expect(p1State.entities.find(e => e.id === hub2p2.id)).toBeUndefined();

            // --- TURN 3 ---
            console.log('Turn 3: Timer Expiration');
            // Refresh hub2p1 from latest state
            const h2p1Latest = p1State.entities.find(e => e.owner === p1Id && e.id !== hub1p1.id);
            console.log(`Hub 2 status: ${!!h2p1Latest}, Deployed: ${h2p1Latest?.deployed}, HP: ${h2p1Latest?.hp}, Energy: ${p1State.players[p1Id].energy}, Phase: ${p1State.phase}`);
            
            p1.emit('submitActions', [{ playerId: p1Id, sourceId: h2p1Latest.id, itemType: 'EXTRACTOR', angle: 0, distance: 300 }]);
            
            // P2 does nothing, wait for timer (5s) + resolution
            await waitFor(() => p1State.turn === 4 && p1State.phase === 'PLANNING', 30000);
            
            const p1Extractors = p1State.entities.filter(e => e.owner === p1Id && (e.itemType === 'EXTRACTOR' || e.type === 'EXTRACTOR'));
            if (p1Extractors.length === 0) {
                console.log(`P1 Entities at Turn 4: ${p1State.entities.map(e => `${e.type}:${e.owner}:${e.id}`).join(', ')}`);
            }
            expect(p1Extractors.length).toBeGreaterThan(0);

            // --- TURN 4 ---
            console.log('Turn 4: Passive Recovery');
            p1.emit('submitActions', []);
            p2.emit('submitActions', []);
            await waitFor(() => p1State.turn === 5 && p1State.phase === 'PLANNING', 25000);

            // --- TURN 5 ---
            console.log('Turn 5: Hard Drop Protocol');
            // Wait for resolution to BE ACTIVE (must wait for 5s timer + buffer)
            await waitFor(() => p1Resolution === true, 25000);
            
            // This late submission should be rejected because phase is RESOLVING
            console.log('Emitting late submission during resolution...');
            p1.emit('submitActions', [{ playerId: p1Id, sourceId: hub1p1.id, itemType: 'WEAPON', angle: 0, distance: 100 }]);
            
            await waitFor(() => p1State.turn === 6 && p1State.phase === 'PLANNING', 25000);
            expect(p1State.entities.find(e => e.owner === p1Id && (e.itemType === 'WEAPON' || e.type === 'WEAPON'))).toBeUndefined();

            console.log('INTEGRATION TEST PASSED');

        } finally {
            p1.disconnect();
            p2.disconnect();
            serverProcess.kill();
        }
    }, 120000);
});
