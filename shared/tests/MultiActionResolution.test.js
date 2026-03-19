import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';

describe('GameState - Multi-Action Resolution', () => {
    let game;
    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['player1', 'player2']);
    });

    it('should launch actions from unique hubs in the same round', () => {
        const hubs = game.entities.filter(e => e.owner === 'player1' && e.type === 'HUB');
        // Ensure player1 has 2 hubs for the test
        const hubA = hubs[0];
        // Set fixed position for hubA
        hubA.x = 250;
        hubA.y = 500;

        const hubB = game.addEntity({ type: 'HUB', owner: 'player1', x: 500, y: 500 });
        hubB.deployed = true; // Ensure it's active
        game.addLink(hubA.id, hubB.id, 'player1');

        const actions = {
            player1: [
                { playerId: 'player1', sourceId: hubA.id, itemType: 'WEAPON', angle: 0, distance: 100 },
                { playerId: 'player1', sourceId: hubB.id, itemType: 'WEAPON', angle: 0, distance: 100 },
                { playerId: 'player1', sourceId: hubB.id, itemType: 'WEAPON', angle: 180, distance: 100 }
            ],
            player2: []
        };

        const snapshots = game.resolveTurn(actions);

        // Find first sub-tick snapshot where projectiles should be visible
        const round1Sub = snapshots.find(s => s.type === 'ROUND_SUB' && s.round === 1 && s.subTick === 6);

        // We expect exactly 2 projectiles in Round 1 (one from Hub A, one from Hub B)
        const round1ProjCount = round1Sub.state.entities.filter(e => e.type === 'PROJECTILE').length;

        // Currently, it should pass!
        expect(round1ProjCount).toBe(2);

        // Verify Round 2 contains the remaining action from Hub B
        const round2Sub = snapshots.find(s => s.type === 'ROUND_SUB' && s.round === 2 && s.subTick === 6);
        expect(round2Sub).toBeDefined();
        const round2ProjCount = round2Sub.state.entities.filter(e => e.type === 'PROJECTILE').length;
        expect(round2ProjCount).toBe(1);
    });

    it('should only fire defense once per round even with multiple fuel (overwhelming)', () => {
        // Setup Defense
        const def = game.addEntity({ type: 'LASER_POINT_DEFENSE', owner: 'player2', x: 250, y: 550 });
        def.fuel = 5; // Give it lots of fuel for testing
        def.deployed = true;

        // Hub A and Hub B from Player 1 will fire simultaneously at Player 2 Area
        const hubA = game.entities.find(e => e.owner === 'player1' && e.isStarter);
        hubA.x = 250;
        hubA.y = 650; // Closer to defense (250, 550)

        const hubB = game.addEntity({ type: 'HUB', owner: 'player1', x: 320, y: 620 });
        hubB.deployed = true;
        game.addLink(hubA.id, hubB.id, 'player1');

        const actions = {
            player1: [
                { playerId: 'player1', sourceId: hubA.id, itemType: 'WEAPON', angle: -90, distance: 100 }, // Aiming up
                { playerId: 'player1', sourceId: hubB.id, itemType: 'WEAPON', angle: -90, distance: 100 }  // Aiming up
            ],
            player2: []
        };

        const snapshots = game.resolveTurn(actions);

        // Find Round 1 Final snapshot (after sub-ticks)
        // If the defense fired only once, one projectile should have survived the round
        // Wait, Laser Defense destroys them instantly in-flight.
        // We look for "LASER_BEAM" visuals or count active projectiles in ROUND_SUB.

        // Find snapshot at subTick 12 where both projectiles are in flight and in range
        const subSnap = snapshots.find(s => s.type === 'ROUND_SUB' && s.round === 1 && s.subTick === 12);
        expect(subSnap).toBeDefined();

        const projectiles = subSnap.state.entities.filter(e => e.type === 'PROJECTILE');
        const projCount = projectiles.length;

        // We expect exactly 1 projectile to remain because the defense is limited to 1 shot per round
        expect(projCount).toBe(1);
    });
});
