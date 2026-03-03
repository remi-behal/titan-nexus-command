import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from './GameState.js';

describe('GameState - Link Collision Math', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['p1', 'p2']);
    });

    it('should detect simple intersection between two segments', () => {
        const seg1 = { p1: { x: 0, y: 0 }, p2: { x: 10, y: 10 } };
        const seg2 = { p1: { x: 0, y: 10 }, p2: { x: 10, y: 0 } };

        const intersection = GameState.doSegmentsIntersect(seg1, seg2);
        expect(intersection).toBeTruthy();
        expect(intersection.x).toBe(5);
        expect(intersection.y).toBe(5);
    });

    it('should not detect intersection for parallel segments', () => {
        const seg1 = { p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 } };
        const seg2 = { p1: { x: 0, y: 2 }, p2: { x: 10, y: 2 } };

        expect(GameState.doSegmentsIntersect(seg1, seg2)).toBeNull();
    });

    it('should decompose wrapping links into Euclidean segments', () => {
        // Map width is 2000, height 2000
        // Link from 1990 to 10 across X edge
        const start = { x: 1990, y: 100 };
        const end = { x: 10, y: 100 };

        const segments = GameState.getLinkSegments(start, end, 2000, 2000);
        expect(segments.length).toBe(2);

        // Horizontal wrap
        expect(segments[0].p1.x).toBe(1990);
        expect(segments[0].p2.x).toBe(2000);
        expect(segments[1].p1.x).toBe(0);
        expect(segments[1].p2.x).toBe(10);
    });

    it('should detect intersection across a toroidal wrap', () => {
        // Seg 1 wraps X: 1990 -> 10 at y=100
        const segments1 = GameState.getLinkSegments({ x: 1990, y: 100 }, { x: 10, y: 100 }, 2000, 2000);
        // Seg 2 is vertical: 0 -> 200 at x=1995
        const segments2 = GameState.getLinkSegments({ x: 1995, y: 0 }, { x: 1995, y: 200 }, 2000, 2000);

        let hit = false;
        for (const s1 of segments1) {
            for (const s2 of segments2) {
                if (GameState.doSegmentsIntersect(s1, s2)) hit = true;
            }
        }
        expect(hit).toBe(true);
    });

    it('should destroy structures that cross during turn resolution (Simultaneous)', () => {
        // Player 1 at (500,500)
        // Player 2 at (600,600)
        // P1 launches to (600, 500)
        // P2 launches to (500, 600)
        // These links cross at (550, 550) approx

        const p1Hub = game.entities.find(e => e.owner === 'p1' && e.type === 'HUB');
        const p2Hub = game.entities.find(e => e.owner === 'p2' && e.type === 'HUB');

        // Reposition for predictable test
        p1Hub.x = 500; p1Hub.y = 500;
        p2Hub.x = 600; p2Hub.y = 600;

        const actions = {
            p1: [{
                playerId: 'p1',
                sourceId: p1Hub.id,
                itemType: 'HUB',
                angle: 45, // Points down-right
                distance: 141 // ~100*sqrt(2)
            }],
            p2: [{
                playerId: 'p2',
                sourceId: p2Hub.id,
                itemType: 'HUB',
                angle: 225, // Points up-left
                distance: 141
            }]
        };

        // P1: (500,500) -> (600,600)
        // P2: (600,500) -> (500,600) -- wait, p2 is at (600,600)
        // If P1: (500,500) to (600,600)
        // If P2: (600,500) to (500,600)
        // Let's use simpler cross:
        // P1: (500,550) -> (600,550) - horizontal
        // P2: (550,500) -> (550,600) - vertical
        p1Hub.x = 500; p1Hub.y = 550;
        p2Hub.x = 550; p2Hub.y = 500;

        actions.p1[0].angle = 0; actions.p1[0].distance = 100;
        actions.p2[0].angle = 90; actions.p2[0].distance = 100;

        game.resolveTurn(actions);

        // Both should be destroyed (And thus filtered out of the state)
        const newEntities = game.entities.filter(e => e.id !== p1Hub.id && e.id !== p2Hub.id);
        expect(newEntities.length).toBe(0);
    });
});
