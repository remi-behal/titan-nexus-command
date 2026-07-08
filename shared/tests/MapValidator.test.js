import { describe, it, expect } from 'vitest';
import { validateMapConfig } from '../utils/MapValidator.js';

describe('validateMapConfig', () => {
    it('should pass valid map configs', () => {
        const config = {
            width: 2000,
            height: 2000,
            playerBases: [
                { id: 'p1', x: 250, y: 500, owner: 'player1' },
                { id: 'p2', x: 750, y: 500, owner: 'player2' }
            ],
            resources: [
                { id: 'r1', x: 500, y: 500, type: 'STANDARD' }
            ],
            lakes: [
                { id: 'l1', x: 1000, y: 1000, radius: 150 }
            ],
            mountains: [
                { id: 'm1', x: 1500, y: 1500, radius: 100 }
            ],
            modifiers: {
                windEnabled: true
            }
        };

        const result = validateMapConfig(config);
        expect(result.width).toBe(2000);
        expect(result.height).toBe(2000);
        expect(result.playerBases.length).toBe(2);
        expect(result.resources.length).toBe(1);
        expect(result.lakes.length).toBe(1);
        expect(result.mountains.length).toBe(1);
        expect(result.modifiers.windEnabled).toBe(true);
    });

    it('should throw on non-object inputs', () => {
        expect(() => validateMapConfig(null)).toThrow('Map data must be a valid JSON object');
        expect(() => validateMapConfig("not an object")).toThrow('Map data must be a valid JSON object');
    });

    it('should enforce map dimensions limits', () => {
        expect(() => validateMapConfig({ width: 499, height: 2000 })).toThrow('Map width must be a number between 500 and 5000');
        expect(() => validateMapConfig({ width: 2000, height: 5001 })).toThrow('Map height must be a number between 500 and 5000');
    });

    it('should throw on out-of-bounds coordinates', () => {
        const config = {
            width: 1000,
            height: 1000,
            playerBases: [
                { id: 'p1', x: 1001, y: 500, owner: 'player1' }
            ]
        };
        expect(() => validateMapConfig(config)).toThrow('Player base coordinates must be valid numbers within map bounds');
    });

    it('should reject invalid base owners', () => {
        const config = {
            width: 1000,
            height: 1000,
            playerBases: [
                { id: 'p1', x: 500, y: 500, owner: 'player9' }
            ]
        };
        expect(() => validateMapConfig(config)).toThrow('Player base owner must be player1 through player8');
    });

    it('should enforce base limit of 8', () => {
        const bases = [];
        for (let i = 1; i <= 9; i++) {
            bases.push({ id: `p${i}`, x: 500, y: 500, owner: `player${Math.min(i, 8)}` });
        }
        const config = {
            width: 1000,
            height: 1000,
            playerBases: bases
        };
        expect(() => validateMapConfig(config)).toThrow('A map cannot have more than 8 player bases');
    });

    it('should strip extra unvalidated properties', () => {
        const config = {
            width: 1000,
            height: 1000,
            maliciousProperty: 'injected',
            playerBases: [
                { id: 'p1', x: 500, y: 500, owner: 'player1', extra: 'pollution' }
            ]
        };
        const result = validateMapConfig(config);
        expect(result.maliciousProperty).toBeUndefined();
        expect(result.playerBases[0].extra).toBeUndefined();
    });
});
