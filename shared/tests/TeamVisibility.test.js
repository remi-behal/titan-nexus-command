import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';

describe('VisibilitySystem - Team Shared Vision', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['p1', 'p2', 'p3'], null, {
            p1: 'Team A',
            p2: 'Team A',
            p3: 'Team B'
        });
    });

    it('should share standard vision between teammates', () => {
        // Move p2's hub far away from p1's hub to check shared vision
        const p2Hub = game.entities.find(e => e.owner === 'p2');
        p2Hub.x = 1000;
        p2Hub.y = 1000;

        // Position (1050, 1000) is 50px away from p2's hub (vision 400),
        // but 770px away from p1's hub (200, 500)
        expect(game.isPositionVisible('p1', 1050, 1000)).toBe(true);
        expect(game.isPositionVisible('p3', 1050, 1000)).toBe(false); // enemy teammate p3 cannot see it
    });

    it('should merge teammate vision in getVisionCircles', () => {
        const p2Hub = game.entities.find(e => e.owner === 'p2');
        p2Hub.x = 1000;
        p2Hub.y = 1000;

        const circles = game.getVisionCircles('p1');
        
        // Should include p1's hubs AND p2's hubs (teammates)
        const owners = circles.map(c => {
            const ent = game.entities.find(e => e.x === c.x && e.y === c.y);
            return ent ? ent.owner : null;
        });
        expect(owners).toContain('p1');
        expect(owners).toContain('p2');
        expect(owners).not.toContain('p3');
    });

    it('should allow teammates to see friendly cloaked units', () => {
        // Move p2's hub next to a friendly Cloaking Field placed by p1
        const p2Hub = game.entities.find(e => e.owner === 'p2');
        const p3Hub = game.entities.find(e => e.owner === 'p3');

        p2Hub.x = 1000;
        p2Hub.y = 1000;

        const cloak = game.addEntity({
            type: 'CLOAKING_FIELD',
            owner: 'p1',
            x: 1000,
            y: 950,
            deployed: true
        });

        // Get visible states
        const p1State = game.getVisibleState('p1');
        const p2State = game.getVisibleState('p2');

        // p1 and teammate p2 should see the Cloaking Field and p2's hub
        expect(p1State.entities.find(e => e.id === cloak.id)).toBeDefined();
        expect(p2State.entities.find(e => e.id === cloak.id)).toBeDefined();

        // enemy p3 (Team B) is far away and should NOT see the Cloaking Field
        p3Hub.x = 1800;
        p3Hub.y = 1800;
        const p3StateFar = game.getVisibleState('p3');
        expect(p3StateFar.entities.find(e => e.id === cloak.id)).toBeUndefined();
    });
});
