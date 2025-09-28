// 統合ステータス定義
// ゲーム内の継続/一時的効果は全て Status として扱う。

import type { Actor } from '$lib/domain/entities/Character';
import type { Status, StatusDef, StatusInstance } from '$lib/domain/entities/Status';
import { pushCombatLog } from '$lib/presentation/utils/logUtil';
import { playEffectOnActor } from '$lib/presentation/utils/effectBus';

// ---- 定義一覧 ----
export const status = {
  Guard: {
    name: 'ガード',
    description: '物理ダメージ80%カット',
    ContinuousTurns: 1,
    apply: (actor) => {
      const physDamageCutRate = 0.8;
      const physDamageThroughRate = (1 - actor.physDamageCutRate) * (1 - physDamageCutRate);
      actor.physDamageCutRate = 1 - physDamageThroughRate;
    },
    Immediate: true,
    badgeClass: 'bg-green-700/70 border-green-300'
  },
  Poison: {
    name: '毒',
    description: 'ターン開始時に3ダメージ (3ターン)',
    ContinuousTurns: 3,
    // 毒は多重化: 残ターンが異なる個別インスタンスとして保持
    badgeClass: 'bg-purple-700/70 border-purple-300',
    apply: (actor) => {
      const dmg = 3; // 現仕様固定
      actor.hp -= dmg;
      pushCombatLog(`毒で${dmg}のダメージ！`, actor.side, actor.kind);
      // エフェクトIDは effectBus の定義 (PoisonTick) に合わせる
      playEffectOnActor(actor, 'PoisonTick', 500);
    },
    Immediate: false
  },
  AttackUp: {
    name: '攻撃力上昇',
    description: '物理ダメージ30%アップ',
    ContinuousTurns: 3,
    // 攻撃上昇も個別インスタンス化 (1インスタンス=+20%)
    badgeClass: 'bg-orange-600/70 border-orange-300',
    apply: (actor) => {
      const physDamageUpRate = 0.3;
      const physDamageThroughRate = (1 + actor.physDamageUpRate) * (1 + physDamageUpRate);
      actor.physDamageUpRate = physDamageThroughRate - 1;
    },
    Immediate: true
  }
} satisfies Record<string, StatusDef>;

export function createStatus(id: Status): StatusInstance {
  const def = status[id];
  return { id, remainingTurns: def.ContinuousTurns };
}

export function findStatus(actor: Actor, id: Status) {
  return actor.statuses.find((s) => s.id === id);
}

export function addStatus(actor: Actor, id: Status) {
  const def: StatusDef = status[id];
  const inst: StatusInstance = { id, remainingTurns: def.ContinuousTurns };
  if (def.Immediate && def.apply) {
    def.apply(actor);
  }
  if (inst.remainingTurns === undefined || inst.remainingTurns > 0) actor.statuses.push(inst);
}

export function removeStatus(actor: Actor, id: Status) {
  actor.statuses = actor.statuses.filter((s) => s.id !== id);
}

export function removeStatusInstance(actor: Actor, inst: StatusInstance) {
  actor.statuses = actor.statuses.filter((s) => s !== inst);
}

/**
 * 対象アクターの "自ターン開始時" にのみ呼び出す。
 * 仕様変更: 以前は全アクターを一括処理していたため Guard / AttackUp (Immediate) が
 * 直後に失効してしまっていた。現在は以下の順序で処理する:
 * 1. 一旦一時効果(攻撃/防御補正)をリセット
 * 2. Immediate=true のステータス: remainingTurns が 1 のものはこのターンで失効するため適用せず、それ以外は再計算目的で apply 実行
 * 3. Immediate=false のステータス: apply (継続効果 / ダメージ等) を実行
 * 4. すべてのステータスについて残ターンを 1 減算し、0 以下を削除
 *    -> Guard(1T) は付与ターン終了後、対象の次ターン開始で効果を再適用せず即削除されるため
 *       「付与直後～次ターン開始直前」まで有効となる。Poison(3T) は 3 回ダメージ tick する。
 */
export function tickStatusesTurnStart(actor: Actor) {
  resetStatusesEffects(actor);
  // Immediate ステ (永続再計算系) を first-pass: 失効予定(remaining=1)は適用しない
  for (const inst of actor.statuses) {
    const def = status[inst.id];
    if (def.Immediate && def.apply) {
      if (inst.remainingTurns === undefined || inst.remainingTurns > 1) {
        def.apply(actor);
      }
    }
  }
  // 非 Immediate ステ (ターン開始で効果発動するもの: 毒など)
  for (const inst of [...actor.statuses]) {
    const def = status[inst.id];
    if (!def.Immediate && def.apply) {
      def.apply(actor);
    }
  }
  // 残ターン減算 & 失効
  for (const inst of [...actor.statuses]) {
    if (inst.remainingTurns !== undefined) {
      inst.remainingTurns -= 1;
      if (inst.remainingTurns <= 0) {
        removeStatusInstance(actor, inst);
      }
    }
  }
}

function resetStatusesEffects(actor: Actor) {
  actor.physDamageUpRate = 0;
  actor.physDamageCutRate = 0;
  actor.psyDamageUpRate = 0;
  actor.psyDamageCutRate = 0;
}
