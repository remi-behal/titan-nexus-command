import { describe, it, expect, vi } from 'vitest';
import { TimerService } from './TimerService.js';
import { SessionContext } from '../context/SessionContext.js';

describe('TimerService Schedule loops', () => {
    it('should start timer with matching TURN_DURATION', () => {
        const context = new SessionContext();
        context.io = { emit: vi.fn() };
        const timer = new TimerService(context);
        timer.startTimer();
        expect(timer.timeRemaining).toBe(30);
        timer.stop();
    });
});
