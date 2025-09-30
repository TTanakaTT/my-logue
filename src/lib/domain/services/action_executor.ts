import { emitActionLog } from '$lib/presentation/utils/logUtil';
import { getAction } from '$lib/data/repositories/action_repository';
import type { Action } from '$lib/domain/entities/action';
import type { Actor } from '$lib/domain/entities/character';
import type { GameState } from '$lib/domain/entities/battle_state';
import { persistRevealedActions } from '$lib/domain/services/state_service';
import { triggerActionEffects } from '$lib/presentation/utils/effectBus';

export interface PerformResult {
  actorDied?: Actor;
  targetDied?: Actor;
  enemyDefeated?: boolean;
  playerDefeated?: boolean;
  revealedAdded?: boolean;
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
  let revealedAdded = false;
  if (actor.side === 'enemy') {
    if (!actor.revealedActions) actor.revealedActions = [];
    if (!actor.revealedActions.includes(id)) {
      actor.revealedActions.push(id);
      revealedAdded = true;
      if (actor.kind !== 'player') {
        persistRevealedActions(actor.kind, state.floorIndex, actor.revealedActions);
      }
    }
  }
  const result: PerformResult = { revealedAdded };
  if (target && target.hp <= 0) {
    if (target.side === 'enemy') result.enemyDefeated = true;
    else result.playerDefeated = true;
    result.targetDied = target;
    result.actorDied = target;
  }
  return result;
}
