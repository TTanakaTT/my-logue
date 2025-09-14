import type { GameState } from '../entities/battleState';
import type { Actor } from '../entities/character';
import type { ActionDef } from '../entities/action';
import { pushCombatLog } from '../state/state';

export function emitActionLog(
  state: GameState,
  actor: Actor,
  target: Actor | undefined,
  def: ActionDef
) {
  const message = def.log ? def.log({ actor, target, state }) : undefined;
  if (!message) return;
  pushCombatLog(state, message, actor.side, actor.kind);
}
