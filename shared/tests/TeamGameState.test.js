import { describe, it, expect } from 'vitest';
import { GameState } from '../GameState.js';

describe('GameState - Team Starting Base Assignment', () => {
    it('should assign starting bases based on player team selection from map config', () => {
        const game = new GameState();
        
        // Define map config with designated team bases
        const mapConfig = {
            width: 2000,
            height: 2000,
            playerBases: [
                { id: 'b1', x: 100, y: 500, team: 'Team A' },
                { id: 'b2', x: 200, y: 500, team: 'Team A' },
                { id: 'b3', x: 1800, y: 500, team: 'Team B' }
            ]
        };

        const playerIds = ['p1', 'p2', 'p3'];
        
        // Mock team assignment metadata inside initializeGame
        // We will pass team assignments as a third optional parameter to initializeGame
        const playerTeams = {
            p1: 'Team A',
            p2: 'Team B',
            p3: 'Team A'
        };

        game.initializeGame(playerIds, mapConfig, playerTeams);

        // Check player teams
        expect(game.players['p1'].team).toBe('Team A');
        expect(game.players['p2'].team).toBe('Team B');
        expect(game.players['p3'].team).toBe('Team A');

        // Check starting hub assignments
        const p1Hub = game.entities.find(e => e.owner === 'p1' && e.type === 'HUB');
        const p2Hub = game.entities.find(e => e.owner === 'p2' && e.type === 'HUB');
        const p3Hub = game.entities.find(e => e.owner === 'p3' && e.type === 'HUB');

        expect(p1Hub).toBeDefined();
        expect(p1Hub.x).toBe(100);

        expect(p2Hub).toBeDefined();
        expect(p2Hub.x).toBe(1800);

        expect(p3Hub).toBeDefined();
        expect(p3Hub.x).toBe(200);
    });

    it('should fallback to default sequential base assignment if no team config matching is possible', () => {
        const game = new GameState();
        const mapConfig = {
            width: 2000,
            height: 2000,
            playerBases: [
                { id: 'b1', x: 100, y: 500 },
                { id: 'b2', x: 200, y: 500 }
            ]
        };

        const playerIds = ['p1', 'p2'];
        game.initializeGame(playerIds, mapConfig);

        const p1Hub = game.entities.find(e => e.owner === 'p1' && e.type === 'HUB');
        const p2Hub = game.entities.find(e => e.owner === 'p2' && e.type === 'HUB');

        expect(p1Hub.x).toBe(100);
        expect(p2Hub.x).toBe(200);
    });

    it('should initialize default map with 8 bases grouped into 4 Team A and 4 Team B bases', () => {
        const game = new GameState();
        const playerIds = ['p1', 'p2', 'p3', 'p4'];
        const playerTeams = {
            p1: 'Team A',
            p2: 'Team B',
            p3: 'Team A',
            p4: 'Team B'
        };

        game.initializeGame(playerIds, null, playerTeams);

        const p1Hub = game.entities.find(e => e.owner === 'p1' && e.type === 'HUB');
        const p2Hub = game.entities.find(e => e.owner === 'p2' && e.type === 'HUB');
        const p3Hub = game.entities.find(e => e.owner === 'p3' && e.type === 'HUB');
        const p4Hub = game.entities.find(e => e.owner === 'p4' && e.type === 'HUB');

        expect(p1Hub.x).toBe(200); // 1st Team A base
        expect(p2Hub.x).toBe(1800); // 1st Team B base
        expect(p3Hub.x).toBe(200); // 2nd Team A base
        expect(p4Hub.x).toBe(1800); // 2nd Team B base
    });

    it('should resolve team-level victory when all opposing team members have lost all hubs', () => {
        const game = new GameState();
        game.initializeGame(['p1', 'p2', 'p3'], null, {
            p1: 'Team A',
            p2: 'Team A',
            p3: 'Team B'
        });

        // Destroy p3's hub (Team B)
        game.entities = game.entities.filter(e => e.owner !== 'p3');

        // Resolve turn with empty actions
        game.resolveTurn({});

        expect(game.winner).toBe('Team A');
    });

    it('should resolve to DRAW when all players on both teams have lost all hubs', () => {
        const game = new GameState();
        game.initializeGame(['p1', 'p2', 'p3'], null, {
            p1: 'Team A',
            p2: 'Team A',
            p3: 'Team B'
        });

        // Destroy all hubs
        game.entities = game.entities.filter(e => e.type !== 'HUB');

        // Resolve turn with empty actions
        game.resolveTurn({});

        expect(game.winner).toBe('DRAW');
    });
});
