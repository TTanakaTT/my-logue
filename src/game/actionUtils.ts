import type { ActionDef, GameState, Actor } from './types';
import { pushCombatLog } from './state';

// アクション共通: ログ出力
export function emitActionLog(
  state: GameState,
  actor: Actor,
  target: Actor | undefined,
  def: ActionDef,
  formula: { result: number; calc: string } | undefined,
  extra?: string
) {
  if (!def.logTemplate && !extra) return;
  const actorName =
    actor === state.player
      ? 'プレイヤー'
      : state.enemy?.kind === 'boss' && actor === state.enemy
        ? 'ボス'
        : '敵';
  const targetName = target
    ? target === state.player
      ? 'プレイヤー'
      : state.enemy?.kind === 'boss' && target === state.enemy
        ? 'ボス'
        : '敵'
    : '';
  let base = def.logTemplate || '';
  if (base) {
    base = base
      .replace('{actor}', actorName)
      .replace('{target}', targetName)
      .replace('{calc}', formula?.calc ?? '')
      .replace('{result}', formula ? String(formula.result) : '');
  }
  const message = [base, extra].filter(Boolean).join(' ');
  const tag: 'player' | 'enemy' | 'boss' =
    actor === state.player
      ? 'player'
      : state.enemy && state.enemy.kind === 'boss' && actor === state.enemy
        ? 'boss'
        : 'enemy';
  pushCombatLog(state, message, tag);
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
