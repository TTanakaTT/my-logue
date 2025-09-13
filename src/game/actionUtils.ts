import type { ActionDef, GameState, Actor } from './types';
import { pushCombatLog } from './state';

// アクション共通: ログ出力
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

// アクション共通: ダメージ適用 (ガード半減処理含む)
export function applyDamage(
  state: GameState,
  source: Actor,
  target: Actor | undefined,
  amount: number
) {
  if (!target) return undefined;
  let final = amount;
  if (target.guard) {
    final = Math.ceil(final / 2);
    target.guard = false; // 1回で解除
  }
  target.hp -= final;
  return final;
}
