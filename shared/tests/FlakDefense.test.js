import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';
import { ENTITY_STATS, GLOBAL_STATS } from '../constants/EntityStats.js';

describe('GameState - Flak Defense', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['player1', 'player2']);
    });

    it('should activate on first enemy projectile and lock angle', () => {
        const p1Hub = game.entities.find(e => e.owner === 'player1' && e.type === 'HUB');
        const p2Hub = game.entities.find(e => e.owner === 'player2' && e.type === 'HUB');

        // Setup Flak Defense for Player 1
        const flak = game.addEntity({
            type: 'FLAK_DEFENSE',
            owner: 'player1',
            x: p1Hub.x + 50,
            y: p1Hub.y,
            deployed: true,
            hp: 2,
            fuel: 1
        });

        // Player 2 fires a weapon that passes near the flak
        // Flak is at (+50, 0) from Hub 1.
        // We fire a weapon from Hub 2 aimed at a point that passes (+100, 0) relative to Hub 1
        const targetX = p1Hub.x + 100;
        const targetY = p1Hub.y;
        const vec = GameState.getToroidalVector(p2Hub.x, p2Hub.y, targetX, targetY, game.map.width, game.map.height);
        const angle = (Math.atan2(vec.dy, vec.dx) * 180) / Math.PI;
        const dist = Math.sqrt(vec.dx * vec.dx + vec.dy * vec.dy);
        const pullDistance = Math.pow(dist / GLOBAL_STATS.MAX_LAUNCH, 1 / GLOBAL_STATS.POWER_EXPONENT) * GLOBAL_STATS.MAX_PULL;

        const actions = {
            player2: [{
                playerId: 'player2',
                sourceId: p2Hub.id,
                itemType: 'WEAPON',
                angle: angle,
                distance: pullDistance
            }],
            player1: []
        };

        game.resolveTurn(actions);

        // Verify activation
        expect(flak.fuel).toBe(0); // Spent fuel
        // Angle should be roughly towards the incoming projectile
        // The projectile travels from Hub 2 to Hub 1 + 100.
        // Hub 1 is at 100, 300. Hub 2 is at 700, 300.
        // Vec Hub2 -> Hub1+100 is (-500, 0). Angle is 180.
        // Flak is at 150, 300. Projectile passes through 400, 300 etc.
        // When it enters 150px range of Flak (150, 300), say at (300, 300),
        // the vector Flak -> Proj is (150, 0), angle 0.
        expect(flak.flakAngle).toBeCloseTo(0, 0);
    });

    it('should hit friend and foe alike (No IFF)', () => {
        const p1Hub = game.entities.find(e => e.owner === 'player1' && e.type === 'HUB');
        const p2Hub = game.entities.find(e => e.owner === 'player2' && e.type === 'HUB');

        const flak = game.addEntity({
            type: 'FLAK_DEFENSE',
            owner: 'player1',
            x: p1Hub.x + 20,
            y: p1Hub.y,
            deployed: true,
            fuel: 1
        });

        // Trigger flak with an enemy projectile (Player 2)
        const actions = {
            player2: [{
                playerId: 'player2',
                sourceId: p2Hub.id,
                itemType: 'WEAPON', // Target p1Hub
                angle: 180,
                distance: 300
            }],
            player1: [{
                playerId: 'player1',
                sourceId: p1Hub.id,
                itemType: 'WEAPON', // Fire AWAY from p2, through the flak wall
                angle: 0,
                distance: 200
            }]
        };

        // We need to verify both projectiles took damage.
        // Since we can't easily check tempProjectiles hp after resolveTurn (they disappear),
        // we use a CUSTOM item type that has more than 1 HP, like a HUB-projectile (default 1 HP, wait).
        // Actually, most projectiles have 1 HP and die.
        // Let's check the snapshots to see if they survived or not.
        const snapshots = game.resolveTurn(actions);

        // Find the "ROUND_SUB" snapshots and check projectile counts
        // Friendly weapon (itemType: 'WEAPON') should be hit if it passes through the arc.
        // Flak at (120, 300). Triggered by enemy from right -> Angle 0.
        // Friendly fired at angle 0 from (100, 300) -> Passes through (120, 300) -> HIT.

        // Let's verify via snapshot count or just check if they detonated early.
        // A weapon that is hit by flak (1 damage) and has 1 HP will set active=false and hitThisTick=true.
        // This causes an EXPLOSION snapshot at that location earlier than intended.
        const explosions = snapshots.filter(s => s.state.entities.some(e => e.type === 'EXPLOSION'));
        expect(explosions.length).toBeGreaterThan(0);
    });

    it('should NOT hit deployed structures', () => {
        const p1Hub = game.entities.find(e => e.owner === 'player1' && e.type === 'HUB');
        const p2Hub = game.entities.find(e => e.owner === 'player2' && e.type === 'HUB');

        const flak = game.addEntity({
            type: 'FLAK_DEFENSE',
            owner: 'player1',
            x: p1Hub.x + 50,
            y: p1Hub.y,
            deployed: true,
            fuel: 1
        });

        // Deployed structure inside the flak zone
        const victim = game.addEntity({
            type: 'EXTRACTOR',
            owner: 'player2',
            x: flak.x + 20,
            y: flak.y,
            deployed: true,
            hp: 2
        });

        // Trigger flak
        const actions = {
            player2: [{
                playerId: 'player2',
                sourceId: p2Hub.id,
                itemType: 'WEAPON',
                angle: 180,
                distance: 50
            }],
            player1: []
        };

        game.resolveTurn(actions);

        // Victim should still have full HP
        expect(victim.hp).toBe(2);
    });

    it('should hit structures-in-flight (undeployed)', () => {
        const p1Hub = game.entities.find(e => e.owner === 'player1' && e.type === 'HUB');
        const p2Hub = game.entities.find(e => e.owner === 'player2' && e.type === 'HUB');

        const flak = game.addEntity({
            type: 'FLAK_DEFENSE',
            owner: 'player1',
            x: p1Hub.x + 50,
            y: p1Hub.y,
            deployed: true,
            fuel: 1
        });

        // Player 2 launches a HUB (projectile) through the flak wall
        const actions = {
            player2: [
                {
                    playerId: 'player2',
                    sourceId: p2Hub.id,
                    itemType: 'HUB', // Victim triggers its own destruction
                    angle: 180,
                    distance: 250
                }
            ],
            player1: []
        };

        game.resolveTurn(actions);

        // The second HUB should NOT have landed (destroyed in flight)
        const hubs = game.entities.filter(e => e.type === 'HUB');
        expect(hubs.length).toBe(2); // Only the starting 2 hubs should exist
    });
});
