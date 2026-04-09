import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState.js';
import { ENTITY_STATS } from '../constants/EntityStats.js';

describe('Echo Artillery Functional Tests', () => {
    let game;

    beforeEach(() => {
        game = new GameState();
        game.initializeGame(['p1', 'p2']);
        game.map.lakes = [];
        game.map.mountains = [];
    });

    it('should trigger a retaliation fire in Round 2 if a launch is detected in Round 1', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'p1');
        const p2Hub = game.entities.find((e) => e.owner === 'p2');

        const echo = game.addEntity({
            type: 'ECHO_ARTILLERY',
            owner: 'p2',
            x: p1Hub.x + 100,
            y: p1Hub.y
        });
        game.addLink(p2Hub.id, echo.id, 'p2');

        const actions = {
            p1: [
                {
                    playerId: 'p1',
                    sourceId: p1Hub.id,
                    itemType: 'WEAPON',
                    angle: 0,
                    distance: 100
                }
            ]
        };

        const snapshots = game.resolveTurn(actions);

        const wasFiringR2 = snapshots.some(
            (s) =>
                s.type === 'ROUND_SUB' &&
                s.round === 2 &&
                s.state.entities.some(
                    (e) => (e.type === 'WEAPON' || e.type === 'PROJECTILE') && e.owner === 'p2'
                )
        );

        expect(wasFiringR2).toBe(true);
    });

    it('should NOT trigger if the launch is outside 800px range', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'p1');
        const p2Hub = game.entities.find((e) => e.owner === 'p2');

        const echo = game.addEntity({
            type: 'ECHO_ARTILLERY',
            owner: 'p2',
            x: p1Hub.x + 900,
            y: p1Hub.y
        });
        game.addLink(p2Hub.id, echo.id, 'p2');

        const actions = {
            p1: [
                {
                    playerId: 'p1',
                    sourceId: p1Hub.id,
                    itemType: 'WEAPON',
                    angle: 0,
                    distance: 100
                }
            ]
        };

        const snapshots = game.resolveTurn(actions);
        const wasFiringR2 = snapshots.some(
            (s) =>
                s.type === 'ROUND_SUB' &&
                s.round === 2 &&
                s.state.entities.some(
                    (e) => (e.type === 'WEAPON' || e.type === 'PROJECTILE') && e.owner === 'p2'
                )
        );

        expect(wasFiringR2).toBe(false);
    });

    it('should ignore fog of war when detecting launches (sound-based)', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'p1');
        const p2Hub = game.entities.find((e) => e.owner === 'p2');

        game.entities.forEach((e) => {
            if (e.owner === 'p2') e.vision = 0;
        });

        const echo = game.addEntity({
            type: 'ECHO_ARTILLERY',
            owner: 'p2',
            x: p1Hub.x + 100,
            y: p1Hub.y,
            vision: 0
        });
        game.addLink(p2Hub.id, echo.id, 'p2');

        const actions = {
            p1: [
                {
                    playerId: 'p1',
                    sourceId: p1Hub.id,
                    itemType: 'WEAPON',
                    angle: 0,
                    distance: 100
                }
            ]
        };

        const snapshots = game.resolveTurn(actions);
        const wasFiringR2 = snapshots.some(
            (s) =>
                s.type === 'ROUND_SUB' &&
                s.round === 2 &&
                s.state.entities.some(
                    (e) => (e.type === 'WEAPON' || e.type === 'PROJECTILE') && e.owner === 'p2'
                )
        );

        expect(wasFiringR2).toBe(true);
    });

    it('should only fire once per turn even if multiple launches are detected', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'p1');
        const p2Hub = game.entities.find((e) => e.owner === 'p2');

        const echo = game.addEntity({
            type: 'ECHO_ARTILLERY',
            owner: 'p2',
            x: p1Hub.x + 100,
            y: p1Hub.y
        });
        game.addLink(p2Hub.id, echo.id, 'p2');

        const actions = {
            p1: [
                { playerId: 'p1', sourceId: p1Hub.id, itemType: 'WEAPON', angle: 0, distance: 30 },
                { playerId: 'p1', sourceId: p1Hub.id, itemType: 'WEAPON', angle: 0, distance: 30 }
            ]
        };

        const snapshots = game.resolveTurn(actions);

        let totalP2Firings = 0;
        const seenFires = new Set();
        snapshots
            .filter((s) => s.type === 'ROUND_SUB')
            .forEach((s) => {
                const fired = s.state.entities.some(
                    (e) => (e.type === 'WEAPON' || e.type === 'PROJECTILE') && e.owner === 'p2'
                );
                if (fired && !seenFires.has(s.round)) {
                    totalP2Firings++;
                    seenFires.add(s.round);
                }
            });

        expect(totalP2Firings).toBe(1);
    });

    it('should trigger a chain reaction (P1 (Hub) -> P2 Echo (Round 2) -> P1 Echo (Round 3))', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'p1');
        const p2Hub = game.entities.find((e) => e.owner === 'p2');

        // Add Echo Artillery for P1
        const echoP1 = game.addEntity({
            type: 'ECHO_ARTILLERY',
            owner: 'p1',
            x: p1Hub.x,
            y: p1Hub.y + 50
        });
        game.addLink(p1Hub.id, echoP1.id, 'p1');

        // Add Echo Artillery for P2 near P1's stuff
        const echoP2 = game.addEntity({
            type: 'ECHO_ARTILLERY',
            owner: 'p2',
            x: p1Hub.x + 100,
            y: p1Hub.y
        });
        game.addLink(p2Hub.id, echoP2.id, 'p2');

        const actions = {
            p1: [
                {
                    playerId: 'p1',
                    sourceId: p1Hub.id,
                    itemType: 'WEAPON',
                    angle: 0,
                    distance: 100
                }
            ]
        };

        const snapshots = game.resolveTurn(actions);

        // Round 1: P1 Hub fires manually.
        // Round 2: P2 Echo fires (responding to Round 1 manual launch).
        // Round 3: P1 Echo fires (responding to Round 2 automated launch from P2).

        const wasFiringP2R2 = snapshots.some(
            (s) =>
                s.type === 'ROUND_SUB' &&
                s.round === 2 &&
                s.state.entities.some(
                    (e) => (e.type === 'WEAPON' || e.type === 'PROJECTILE') && e.owner === 'p2'
                )
        );

        const wasFiringP1R3 = snapshots.some(
            (s) =>
                s.type === 'ROUND_SUB' &&
                s.round === 3 &&
                s.state.entities.some(
                    (e) => (e.type === 'WEAPON' || e.type === 'PROJECTILE') && e.owner === 'p1'
                )
        );

        expect(wasFiringP2R2).toBe(true);
        expect(wasFiringP1R3).toBe(true);
    });
    it('should NOT trigger or fire if disabled by EMP', () => {
        const p1Hub = game.entities.find((e) => e.owner === 'p1');
        const p2Hub = game.entities.find((e) => e.owner === 'p2');

        const echo = game.addEntity({
            type: 'ECHO_ARTILLERY',
            owner: 'p2',
            x: p1Hub.x + 100,
            y: p1Hub.y
        });
        game.addLink(p2Hub.id, echo.id, 'p2');

        // Disable the Echo Artillery
        echo.disabledUntilTurn = game.turn + 1;

        const actions = {
            p1: [
                {
                    playerId: 'p1',
                    sourceId: p1Hub.id,
                    itemType: 'WEAPON',
                    angle: 0,
                    distance: 100
                }
            ]
        };

        const snapshots = game.resolveTurn(actions);

        const wasFiringR2 = snapshots.some(
            (s) =>
                s.type === 'ROUND_SUB' &&
                s.round === 2 &&
                s.state.entities.some(
                    (e) => (e.type === 'WEAPON' || e.type === 'PROJECTILE') && e.owner === 'p2'
                )
        );

        // Currently this fails (returns true) because of the bug
        expect(wasFiringR2).toBe(false);
    });
});
