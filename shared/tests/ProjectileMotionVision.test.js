import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';
import { ENTITY_STATS } from '../constants/EntityStats.js';

describe('GameState - Projectile Motion Vision', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['p1', 'p2']);
    });

    it('should reveal cloaked structure based on currX, not x', () => {
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

        // Add a projectile with x=0 (launch) and currX=950 (current)
        const proj = game.addEntity({
            type: 'PROJECTILE',
            itemType: 'HOMING_MISSILE',
            owner: 'p1',
            x: 0,
            y: 0,
            currX: 950,
            currY: 1000,
            active: true
        });

        const visibleState = game.getVisibleState('p1');
        const p2HubInState = visibleState.entities.find(e => e.id === p2Hub.id);

        // Currently this will FAIL because it uses x=0
        expect(p2HubInState).toBeDefined();
    });
});
