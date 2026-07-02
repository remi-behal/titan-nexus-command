import { ENTITY_STATS } from '../../shared/constants/EntityStats.js';

export function validateActions(actions, playerId, game) {
    if (!actions || !Array.isArray(actions)) return [];

    const validatedActions = [];
    const player = game.players[playerId];
    if (!player) return [];

    let totalCost = 0;
    const fuelTracker = {};

    for (const action of actions) {
        if (!action || typeof action !== 'object') continue;

        const sourceEntity = game.entities.find((e) => e.id === action.sourceId);
        if (!sourceEntity) {
            console.log(`[Validation] Action rejected: Source entity ${action.sourceId} not found.`);
            continue;
        }

        if (sourceEntity.owner !== playerId) {
            console.log(`[Validation] Action rejected: Player ${playerId} does not own source entity ${action.sourceId}.`);
            continue;
        }

        if (sourceEntity.disabledUntilTurn !== undefined && sourceEntity.disabledUntilTurn > game.turn) {
            console.log(`[Validation] Action rejected: Source entity ${action.sourceId} is disabled by EMP.`);
            continue;
        }

        const cost = ENTITY_STATS[action.itemType]?.cost || 0;
        if (player.energy < totalCost + cost) {
            console.log(`[Validation] Action rejected: Insufficient energy. Need ${totalCost + cost}, player has ${player.energy}.`);
            continue;
        }

        if (sourceEntity.fuel !== undefined) {
            if (fuelTracker[action.sourceId] === undefined) {
                fuelTracker[action.sourceId] = sourceEntity.fuel;
            }
            if (fuelTracker[action.sourceId] <= 0) {
                console.log(`[Validation] Action rejected: Source entity ${action.sourceId} is out of fuel.`);
                continue;
            }
            fuelTracker[action.sourceId]--;
        }

        totalCost += cost;
        validatedActions.push({ ...action, playerId });
    }

    return validatedActions;
}
