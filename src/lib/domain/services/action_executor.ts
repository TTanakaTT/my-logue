import { emitActionLog } from '$lib/presentation/utils/logUtil';
import { getAction } from '$lib/data/repositories/action_repository';
import type { Action } from '$lib/domain/entities/action';
import { isEnemy, type Actor } from '$lib/domain/entities/character';
import type { GameState } from '$lib/domain/entities/battle_state';
import { addObservedActions } from '$lib/domain/services/state_service';
import { triggerActionEffects } from '$lib/presentation/utils/effectBus';

export interface PerformResult {
  actorDied?: Actor;
  targetDied?: Actor;
  enemyDefeated?: boolean;
  playerDefeated?: boolean;
  observedAdded?: boolean;
}

export function performAction(
  state: GameState,
  actor: Actor,
  target: Actor | undefined,
  id: Action,
  opts?: { isCritical?: boolean }
): PerformResult | undefined {
  const def = getAction(id);
  if (!def) return;
  const isCritical = !!opts?.isCritical;
  const logDef = def as Partial<{
    normalAction: (ctx: { actor: Actor; target?: Actor }) => void;
    criticalAction: (ctx: { actor: Actor; target?: Actor }) => void;
  }>;
  emitActionLog(actor, target, def, { critical: isCritical });
  triggerActionEffects(actor, target, id);
  if (isCritical && logDef.criticalAction) logDef.criticalAction({ actor, target });
  else if (!isCritical && logDef.normalAction) logDef.normalAction({ actor, target });
  else if (logDef.normalAction) logDef.normalAction({ actor, target });
  let observedAdded = false;
  if (isEnemy(actor)) {
    if (!actor.observedActions) actor.observedActions = [];
    if (!actor.observedActions.includes(id)) {
      actor.observedActions.push(id);
      observedAdded = true;
      if (actor.kind !== 'player') {
        addObservedActions(actor.id, actor.observedActions);
      }
    }
  }
  const result: PerformResult = { observedAdded };
  if (target && target.hp <= 0) {
    if (target.side === 'enemy') result.enemyDefeated = true;
    else result.playerDefeated = true;
    result.targetDied = target;
    result.actorDied = target;
  }
  return result;
}
