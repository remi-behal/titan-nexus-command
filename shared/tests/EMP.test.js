import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';
import { ENTITY_STATS, GLOBAL_STATS } from '../constants/EntityStats.js';

describe('EMP Weapon System', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['p1', 'p2']);
        game.map.lakes = [];
        game.map.mountains = [];
    });

    it('should detonate EMP the moment it crosses a shield barrier', () => {
        const shield = game.addEntity({
            type: 'SHIELD',
            owner: 'p1',
            x: 500,
            y: 500,
            deployed: true,
            isStarter: true
        });

        // Launch EMP from p2 toward shield
        const actions = {
            p1: [],
            p2: [{
                playerId: 'p2',
                itemType: 'EMP',
                sourceId: game.entities.find(e => e.owner === 'p2' && e.type === 'HUB').id,
                angle: 180, // Target is p1 at relative 0
                distance: 500 // Map width 2000, p1 at 250 (initial), then we moved shield to 500.
            }]
        };

        // Let's refine the positions for a deterministic test
        const p2Hub = game.entities.find(e => e.owner === 'p2');
        p2Hub.x = 800;
        p2Hub.y = 500;
        shield.x = 500;
        shield.y = 500;
        // Shield range is 125. Boundary is at X=625.
        // EMP travels 800 -> 500. It should hit at 625.

        const snapshots = game.resolveTurn(actions);

        let detonatedAtShield = false;
        snapshots.forEach(s => {
            if (s.type === 'ROUND_SUB') {
                console.log(`[Test Debug] Tick ${s.subTick}: Entities: ${s.state.entities.map(e => e.type).join(', ')}`);
                const explosion = s.state.entities.find(v => v.type === 'EXPLOSION');
                if (explosion) {
                    console.log(`[Test Debug] Explosion at x=${explosion.x}, y=${explosion.y}`);
                    const distToBarrier = Math.abs(explosion.x - 625);
                    if (distToBarrier < 30) detonatedAtShield = true;
                }
            }
        });

        expect(detonatedAtShield).toBe(true);
    });

    it('should apply disabledUntilTurn to entities in blast radius', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'p1');
        p1Hub.x = 500;
        p1Hub.y = 500;

        // Manually trigger EMP explosion at 400, 500 (100px from hub)
        game.triggerExplosion(
            400,
            500,
            ENTITY_STATS.EMP,
            [],
            new Set(),
            game.entities
        );

        // triggerExplosion sets disabledUntilTurn to this.turn + 2
        // Initial turn is 1. So disabledUntilTurn should be 3.
        expect(p1Hub.disabledUntilTurn).toBe(3);
    });

    it('should skip energy generation for disabled entities', () => {
        const p1Hub = game.entities.find(e => e.owner === 'p1' && e.type === 'HUB');
        p1Hub.disabledUntilTurn = game.turn + 1; // Disabled for turn 1

        const initialEnergy = game.players.p1.energy;
        game.resolveTurn({ p1: [], p2: [] });

        // Normal income: GLOBAL_STATS.ENERGY_INCOME_PER_TURN (UBI) + HUB energyGen
        // If disabled, should only get UBI.
        const expectedEnergy = initialEnergy + GLOBAL_STATS.ENERGY_INCOME_PER_TURN;
        expect(game.players.p1.energy).toBe(expectedEnergy);
    });

    it('should skip shield recharge for disabled shields', () => {
        const shield = game.addEntity({ type: 'SHIELD', owner: 'p1', x: 0, y: 0, deployed: true });
        shield.barrierHp = 1;
        shield.disabledUntilTurn = game.turn + 1; // Disabled for turn 1

        game.resolveTurn({ p1: [], p2: [] });

        // Should still be 1 if disabled
        expect(shield.barrierHp).toBe(1);
    });

    it('should cancel queued actions from hit hubs and refund energy', () => {
        const p1Hub = game.entities.find(e => e.owner === 'p1' && e.type === 'HUB');
        const p2Hub = game.entities.find(e => e.owner === 'p2' && e.type === 'HUB');

        // p1 actions: Round 1 launch toward p2
        // p2 actions: Round 1 EMP hit, Round 2 launch toward p1
        const actions = {
            p1: [{
                playerId: 'p1',
                itemType: 'WEAPON',
                sourceId: p1Hub.id,
                angle: 180,
                distance: 200
            }],
            p2: [
                {
                    playerId: 'p2',
                    itemType: 'EMP',
                    sourceId: p2Hub.id,
                    angle: 0,
                    distance: 100 // Land at target
                },
                {
                    playerId: 'p2',
                    itemType: 'WEAPON',
                    sourceId: p2Hub.id,
                    angle: 0,
                    distance: 200
                }
            ]
        };

        // Ensure EMP hits p2Hub in Round 1
        p1Hub.x = 250;
        p2Hub.x = 250 + 100; // Launch at 100 distance.
        p1Hub.y = 500;
        p2Hub.y = 500;

        const initialEnergyP2 = game.players.p2.energy;

        const snapshots = game.resolveTurn(actions);

        // Turn ends. Turn 1 resolution.
        // Round 1: p1 fires EMP, hits p2Hub.
        // Round 2: p2Hub SHOULD have fired WEAPON, but it's disabled.
        // Energy should be: initial + turnIncome - EMPCost (WEAPON cost was refunded)
        const income = GLOBAL_STATS.ENERGY_INCOME_PER_TURN + ENTITY_STATS.HUB.energyGen;
        const expected = initialEnergyP2 + income - ENTITY_STATS.EMP.cost;

        expect(game.players.p2.energy).toBe(expected);

        // Check snapshots:
        // Round 1 (index ~0-20) should have projectiles.
        // Round 2 (starts after the first ROUND snapshot) should have NO projectiles.
        let round2Started = false;
        let p2SecondProjFound = false;
        snapshots.forEach(s => {
            if (s.type === 'ROUND' && s.round === 1) round2Started = true;

            if (round2Started && s.type === 'ROUND_SUB') {
                const projs = s.state.entities.filter(e => e.type === 'PROJECTILE');
                if (projs.length > 0) p2SecondProjFound = true;
            }
        });
        expect(p2SecondProjFound).toBe(false);
    });

    it('should pause nuke countdown when disabled', () => {
        const nuke = game.addEntity({
            type: 'NUKE',
            owner: 'p1',
            x: 0,
            y: 0,
            detonationTurn: game.turn + 2 // Detonates in 2 turns (Turn 3)
        });

        nuke.disabledUntilTurn = game.turn + 1; // Disabled for turn 1

        game.resolveTurn({ p1: [], p2: [] });

        // Should have incremented to Turn 4
        expect(nuke.detonationTurn).toBe(4);
    });
});
