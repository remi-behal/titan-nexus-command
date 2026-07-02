import { validateActions } from '../utils/ActionValidator.js';

export class TimerService {
    constructor(context) {
        this.context = context;
        this.timeRemaining = context.TURN_DURATION;
        this.timerTimeout = null;
        this.RESOLUTION_ROUND_DELAY = parseInt(process.env.RESOLUTION_ROUND_DELAY) || 2000;
        this.RESOLUTION_SUB_TICK_DELAY = parseInt(process.env.RESOLUTION_SUB_TICK_DELAY) || 60;
    }

    startTimer() {
        if (this.timerTimeout) {
            clearTimeout(this.timerTimeout);
            this.timerTimeout = null;
        }
        this.timeRemaining = this.context.TURN_DURATION;
        console.log(`[Timer] NEW TIMER START: ${this.timeRemaining}s`);
        this.context.safeEmit(this.context.io, 'timerUpdate', this.timeRemaining);
        this.timerTimeout = setTimeout(() => this.tick(), 1000);
    }

    tick() {
        this.timeRemaining--;
        this.context.safeEmit(this.context.io, 'timerUpdate', this.timeRemaining);

        if (this.timeRemaining <= 0) {
            console.log('[Timer] Time up!');
            this.resolveTurn();
        } else {
            this.timerTimeout = setTimeout(() => this.tick(), 1000);
        }
    }

    stop() {
        if (this.timerTimeout) {
            clearTimeout(this.timerTimeout);
            this.timerTimeout = null;
        }
    }

    async resolveTurn() {
        const { game, lockedIn, turnActions } = this.context;
        console.log(`[Server] resolveTurn called. Current Phase: ${game.phase}`);
        if (game.phase === 'RESOLVING') return;
        game.phase = 'RESOLVING';

        try {
            this.stop();

            const actionsMap = {
                player1: validateActions(turnActions.player1 || [], 'player1', game),
                player2: validateActions(turnActions.player2 || [], 'player2', game)
            };

            let snapshots;
            try {
                snapshots = game.resolveTurn(actionsMap);
            } catch (err) {
                console.error('CRITICAL ERROR: GameState.resolveTurn failed:', err);
                snapshots = [{ type: 'FINAL', state: game.getState() }];
            }

            this.context.safeEmit(this.context.io, 'syncStatus', { lockedIn });
            this.context.safeEmit(this.context.io, 'resolutionStatus', { active: true, totalRounds: snapshots.length });

            for (const snap of snapshots) {
                this.context.emitFilteredState(snap.state);

                if (snap.type === 'ROUND_START' || snap.type === 'ROUND') {
                    this.context.safeEmit(this.context.io, 'resolutionRound', snap.round);
                }

                const delay = snap.type === 'ROUND_SUB' ? this.RESOLUTION_SUB_TICK_DELAY : this.RESOLUTION_ROUND_DELAY;
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        } finally {
            lockedIn.player1 = false;
            lockedIn.player2 = false;
            turnActions.player1 = [];
            turnActions.player2 = [];
            game.phase = 'PLANNING';

            this.context.emitFilteredState();
            this.context.safeEmit(this.context.io, 'syncStatus', { lockedIn });
            this.context.safeEmit(this.context.io, 'resolutionStatus', { active: false });

            this.startTimer();
        }
    }
}
