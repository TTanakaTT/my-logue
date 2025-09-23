import { emitActionLog } from '$lib/presentation/utils/logUtil';
import { getAction } from '$lib/data/repositories/actionRepository';
import type { Action } from '$lib/domain/entities/Action';
import type { Actor } from '$lib/domain/entities/Character';
import type { GameState } from '$lib/domain/entities/BattleState';
import { persistRevealedActions } from './stateService';
import { triggerActionEffects } from '$lib/presentation/utils/effectBus';

export interface PerformResult {
  actorDied?: Actor; // 行動で死亡したアクター (主に target)
  targetDied?: Actor; // alias
  enemyDefeated?: boolean;
  playerDefeated?: boolean;
  revealedAdded?: boolean;
}

/**
 * 共通行動実行。
 * - アクション取得
 * - ログ出力
 * - execute 呼び出し
 * - 敵の場合: revealedActions 更新 + 永続化
 */
export function performAction(
  state: GameState,
  actor: Actor,
  target: Actor | undefined,
  id: Action
): PerformResult | undefined {
  const def = getAction(id);
  if (!def) return;
  emitActionLog(actor, target, def);
  // UI: アクション開始時のエフェクトをトリガ
  triggerActionEffects(actor, target, id);
  def.execute({ actor, target });
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
  // 死亡チェック
  const result: PerformResult = { revealedAdded };
  if (target && target.hp <= 0) {
    if (target.side === 'enemy') {
      result.enemyDefeated = true;
    } else {
      result.playerDefeated = true;
    }
    result.targetDied = target;
    result.actorDied = target;
  }
  return result;
}
