import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';
import { ENTITY_STATS } from '../constants/EntityStats.js';

describe('GameState - Projectile Cloak Reveal', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['p1', 'p2']);
    });

    it('should reveal cloaked structure if projectile is within 75px', () => {
        const p1Hub = game.entities.find(e => e.owner === 'p1');
        const p2Hub = game.entities.find(e => e.owner === 'p2');

        p2Hub.x = 1000;
        p2Hub.y = 1000;

        game.addEntity({
            type: 'CLOAKING_FIELD',
            owner: 'p2',
            x: 1000,
            y: 1000,
            deployed: true
        });

        // Add a projectile at (950, 1000) facing p2Hub
        // Distance is 50px (within 75px truesight)
        const proj = game.addEntity({
            type: 'PROJECTILE',
            itemType: 'HOMING_MISSILE',
            owner: 'p1',
            x: 950,
            y: 1000,
            currentAngle: 0,
            active: true
        });

        const visibleState = game.getVisibleState('p1');
        const p2HubInState = visibleState.entities.find(e => e.id === p2Hub.id);

        expect(p2HubInState).toBeDefined();
    });

    it('should NOT reveal cloaked structure if projectile is far away (>75px) even if looking at it', () => {
        const p1Hub = game.entities.find(e => e.owner === 'p1');
        const p2Hub = game.entities.find(e => e.owner === 'p2');

        p2Hub.x = 1000;
        p2Hub.y = 1000;

        game.addEntity({
            type: 'CLOAKING_FIELD',
            owner: 'p2',
            x: 1000,
            y: 1000,
            deployed: true
        });

        // Projectile at 200px away (within homing/vision range 300px, but > 75px cloak detection)
        const proj = game.addEntity({
            type: 'PROJECTILE',
            itemType: 'HOMING_MISSILE',
            owner: 'p1',
            x: 800,
            y: 1000,
            currentAngle: 0,
            active: true
        });

        const visibleState = game.getVisibleState('p1');
        const p2HubInState = visibleState.entities.find(e => e.id === p2Hub.id);

        expect(p2HubInState).toBeUndefined();
    });

    it('should stay scouted even after projectile disappears', () => {
        const p1Hub = game.entities.find(e => e.owner === 'p1');
        const p2Hub = game.entities.find(e => e.owner === 'p2');

        p1Hub.x = 250;
        p1Hub.y = 1000;
        p2Hub.x = 1000;
        p2Hub.y = 1000;

        game.addEntity({
            type: 'CLOAKING_FIELD',
            owner: 'p2',
            x: 1000,
            y: 1000,
            deployed: true
        });

        // Launcher angle 0, distance 750 (to hit 1000)
        const actions = {
            p1: [{
                playerId: 'p1',
                sourceId: p1Hub.id,
                itemType: 'HOMING_MISSILE',
                angle: 0,
                distance: 750
            }]
        };

        game.resolveTurn(actions);

        const visibleState = game.getVisibleState('p1');
        const p2HubInState = visibleState.entities.find(e => e.id === p2Hub.id);

        // EXPECTATION: It should have been seen while the missile was within 75px
        expect(p2HubInState).toBeDefined();
    });
});
