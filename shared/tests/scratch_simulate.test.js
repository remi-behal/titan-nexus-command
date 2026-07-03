import { describe, it, expect } from 'vitest';
import { GameState } from '../GameState.js';

describe('scratch simulate', () => {
    it('runs simulation', () => {
        const gs = new GameState();
        gs.initializeGame(['p1', 'p2']);
        gs.entities = [];

        gs.addEntity({
            id: 'h1',
            type: 'HUB',
            owner: 'p1',
            x: 100,
            y: 100,
            hp: 5,
            deployed: true,
            isStarter: true
        });
        gs.addEntity({
            id: 'target',
            type: 'HUB',
            owner: 'p2',
            x: 800,
            y: 100,
            hp: 10,
            deployed: true,
            isStarter: true,
            size: 40
        });

        const snapshots = gs.resolveTurn({
            p1: [
                {
                    playerId: 'p1',
                    sourceId: 'h1',
                    itemType: 'NAPALM',
                    angle: 0,
                    distance: 300
                }
            ]
        });

        console.log('Total Snapshots:', snapshots.length);
        snapshots.forEach(s => {
            if (s.type === 'ROUND') {
                const t = s.state.entities.find(e => e.id === 'target');
                const fires = s.state.entities.filter(e => e.type === 'NAPALM_FIRE');
                console.log(`ROUND ${s.round} - Target HP: ${t ? t.hp : 'N/A'}, Fire entities count: ${fires.length}, roundsLeft: ${fires.map(f => f.roundsLeft)}`);
            } else {
                console.log('Snapshot Type:', s.type, 'Round:', s.round);
            }
        });
        expect(true).toBe(true);
    });
});
