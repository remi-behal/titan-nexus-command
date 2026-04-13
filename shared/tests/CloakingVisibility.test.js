/**
 * CloakingVisibility.test.js
 *
 * Unit tests for the Cloaking Field visibility logic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';
import { ENTITY_STATS } from '../constants/EntityStats.js';

describe('GameState - Cloaking Field Visibility', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['player1', 'player2']);
    });

    it('should hide enemy entities within 300px of a Cloaking Field', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'player1' && e.type === 'HUB');
        const p2Hub = game.entities.find((e) => e.owner === 'player2' && e.type === 'HUB');

        // Move p2Hub far enough from p1 vision but near its own Cloaking Field
        p2Hub.x = 1000;
        p2Hub.y = 1000;

        const cloakField = game.addEntity({
            type: 'CLOAKING_FIELD',
            owner: 'player2',
            x: 1000,
            y: 900, // 100px away from hub
            deployed: true
        });

        // Player 1 places a hub at (700, 1000). 
        // Distance to p2Hub is 300 (just at vision limit).
        // Standard vision would see it.
        p1Hub.x = 700;
        p1Hub.y = 1000;

        const visibleState = game.getVisibleState('player1');
        const p2HubInState = visibleState.entities.find((e) => e.id === p2Hub.id);

        expect(p2HubInState).toBeUndefined();
    });

    it('should reveal cloaked entities when an enemy scout is within 75px', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'player1' && e.type === 'HUB');
        const p2Hub = game.entities.find((e) => e.owner === 'player2' && e.type === 'HUB');

        p2Hub.x = 1000;
        p2Hub.y = 1000;

        game.addEntity({
            type: 'CLOAKING_FIELD',
            owner: 'player2',
            x: 1000,
            y: 1000,
            deployed: true
        });

        // Scout at 70px away
        p1Hub.x = 930;
        p1Hub.y = 1000;

        const visibleState = game.getVisibleState('player1');
        const p2HubInState = visibleState.entities.find((e) => e.id === p2Hub.id);

        expect(p2HubInState).toBeDefined();
        expect(p2HubInState.scouted).toBe(true);
    });

    it('should hide the Cloaking Field structure itself if distance > 75px', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'player1' && e.type === 'HUB');

        const cloakField = game.addEntity({
            type: 'CLOAKING_FIELD',
            owner: 'player2',
            x: 1000,
            y: 1000,
            deployed: true
        });

        // Unit at 100px away (standard vision range)
        p1Hub.x = 900;
        p1Hub.y = 1000;

        const visibleState = game.getVisibleState('player1');
        const fieldInState = visibleState.entities.find((e) => e.id === cloakField.id);

        expect(fieldInState).toBeUndefined();
    });

    it('should disable cloaking if the Field is disabled by EMP', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'player1' && e.type === 'HUB');
        const p2Hub = game.entities.find((e) => e.owner === 'player2' && e.type === 'HUB');

        p2Hub.x = 1000;
        p2Hub.y = 1000;

        const cloakField = game.addEntity({
            type: 'CLOAKING_FIELD',
            owner: 'player2',
            x: 1000,
            y: 1000,
            deployed: true,
            disabledUntilTurn: game.turn + 1 // EMPed
        });

        p1Hub.x = 800; // 200px away
        p1Hub.y = 1000;

        const visibleState = game.getVisibleState('player1');
        const p2HubInState = visibleState.entities.find((e) => e.id === p2Hub.id);

        // Should be visible because cloak is disabled
        expect(p2HubInState).toBeDefined();
    });
});
