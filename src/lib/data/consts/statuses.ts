// 統合ステータス定義
// ゲーム内の継続/一時的効果は全て Status として扱う。

import type { Actor } from '$lib/domain/entities/Character';
import type { Status, StatusDef, StatusInstance } from '$lib/domain/entities/Status';
import { pushCombatLog } from '$lib/presentation/utils/logUtil';

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

export function tickStatusesTurnStart(actor: Actor) {
  // 1. ターン開始時効果適用
  for (const inst of [...actor.statuses]) {
    const def = status[inst.id];
    if (def.apply) {
      def.apply(actor);
    }
  }
  // 2. 残ターン共通減算 + 期限切れ削除
  for (const inst of [...actor.statuses]) {
    if (inst.remainingTurns !== undefined) {
      inst.remainingTurns -= 1;
      if (inst.remainingTurns <= 0) {
        removeStatusInstance(actor, inst);
      }
    }
  }
}
