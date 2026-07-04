import { validateActions } from '../utils/ActionValidator.js';

export class TimerService {
    constructor(roomOrContext) {
        if (roomOrContext && roomOrContext.id !== undefined) {
            // It's a LobbyRoom
            this.room = roomOrContext;
            this.context = roomOrContext.context;
        } else {
            // It's a SessionContext (legacy fallback)
            this.context = roomOrContext;
            this.room = {
                id: 'legacy-context',
                context: this.context,
                game: this.context ? this.context.game : null,
                lockedIn: this.context ? this.context.lockedIn : {},
                turnActions: this.context ? this.context.turnActions : {},
                emit: (io, event, data) => {
                    if (this.context && this.context.safeEmit) {
                        this.context.safeEmit(io, event, data);
                    } else if (io && io.emit) {
                        io.emit(event, data);
                    }
                },
                emitFilteredState: (io, state = null) => {
                    if (this.context && this.context.emitFilteredState) {
                        this.context.emitFilteredState(state);
                    }
                }
            };
        }
        this.timeRemaining = this.context ? this.context.TURN_DURATION : 30;
        this.timerTimeout = null;
        this.RESOLUTION_ROUND_DELAY = parseInt(process.env.RESOLUTION_ROUND_DELAY) || 2000;
        this.RESOLUTION_SUB_TICK_DELAY = parseInt(process.env.RESOLUTION_SUB_TICK_DELAY) || 60;
    }

    startTimer() {
        if (this.timerTimeout) {
            clearTimeout(this.timerTimeout);
            this.timerTimeout = null;
        }
        this.timeRemaining = this.context ? this.context.TURN_DURATION : 30;
        console.log(`[Timer Room ${this.room.id}] NEW TIMER START: ${this.timeRemaining}s`);
        const io = this.context ? this.context.io : null;
        this.room.emit(io, 'timerUpdate', this.timeRemaining);
        this.timerTimeout = setTimeout(() => this.tick(), 1000);
    }

    tick() {
        this.timeRemaining--;
        const io = this.context ? this.context.io : null;
        this.room.emit(io, 'timerUpdate', this.timeRemaining);

        if (this.timeRemaining <= 0) {
            console.log(`[Timer Room ${this.room.id}] Time up!`);
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
        const { game, lockedIn, turnActions } = this.room;
        console.log(`[Server Room ${this.room.id}] resolveTurn. Phase: ${game.phase}`);
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

            const filteredLockedIn = {
                player1: lockedIn.player1,
                player2: lockedIn.player2
            };
            const io = this.context ? this.context.io : null;
            this.room.emit(io, 'syncStatus', { lockedIn: filteredLockedIn });
            this.room.emit(io, 'resolutionStatus', {
                active: true,
                totalRounds: snapshots.length
            });

            for (const snap of snapshots) {
                this.room.emitFilteredState(io, snap.state);

                if (snap.type === 'ROUND_START' || snap.type === 'ROUND') {
                    this.room.emit(io, 'resolutionRound', snap.round);
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

            const io = this.context ? this.context.io : null;
            this.room.emitFilteredState(io);
            this.room.emit(io, 'syncStatus', { lockedIn });
            this.room.emit(io, 'resolutionStatus', { active: false });

            this.startTimer();
        }
    }
}
