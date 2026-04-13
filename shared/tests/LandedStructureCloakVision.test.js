import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';
import { ENTITY_STATS } from '../constants/EntityStats.js';

describe('GameState - Landed Structure Cloak Vision', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['p1', 'p2']);
    });

    it('should reveal cloaked enemy structure if a landed HUB arrives via resolveTurn', () => {
        const p1Hub = game.entities.find(e => e.owner === 'p1');
        const p2Hub = game.entities.find(e => e.owner === 'p2');

        p1Hub.x = 250; p1Hub.y = 1000;
        p2Hub.x = 1000; p2Hub.y = 1000;

        game.addEntity({
            type: 'CLOAKING_FIELD',
            owner: 'p2',
            x: 1000,
            y: 1000,
            deployed: true
        });

        // Launch a HUB from p1 towards p2Hub (dist 750)
        const actions = {
            p1: [{
                playerId: 'p1',
                sourceId: p1Hub.id,
                itemType: 'HUB',
                angle: 0,
                distance: 720 // Land at 970 (30px away from p2Hub)
            }]
        };

        game.resolveTurn(actions);

        // After resolution, p1 has a Hub at (970, 1000)
        // Check Visibility
        const visibleState = game.getVisibleState('p1');
        const p2HubInState = visibleState.entities.find(e => e.id === p2Hub.id);

        expect(p2HubInState).toBeDefined();
    });

    it('should reveal cloaked enemy structure even if the landed structure is still UNDEPLOYED', () => {
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

        // Add an undeployed HUB manually
        game.addEntity({
            type: 'HUB',
            owner: 'p1',
            x: 950,
            y: 1000,
            deployed: false
        });

        const visibleState = game.getVisibleState('p1');
        const p2HubInState = visibleState.entities.find(e => e.id === p2Hub.id);

        expect(p2HubInState).toBeDefined();
    });
});
