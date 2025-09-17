// 統合ステータス定義
// ゲーム内の継続/一時的効果は全て Status として扱う。

import type { Actor } from '$lib/domain/entities/character';

export type StatusId = 'guard' | 'poison' | 'attackUp';

export interface StatusDefinition {
  id: StatusId;
  name: string; // UI表示
  description: string;
  // 新規付与時: 既存がある場合の挙動 (refreshTurns, stack, ignore)
  onApply?: (actor: Actor, inst: StatusInstance, existing?: StatusInstance) => void;
  // ターン終了時 (各Actorごと endTurn 内) に呼び出される
  onTurnEnd?: (actor: Actor, inst: StatusInstance) => void;
  // 削除直前
  onRemove?: (actor: Actor, inst: StatusInstance) => void;
  // ダメージ計算前の物理ダメージ軽減倍率 (1.0=等倍) guardなど
  physicalDamageMultiplier?: (actor: Actor, inst: StatusInstance) => number;
  // 行動後 or 他 Hook 拡張余地
  // 付与時のターン初期値 (延長などは onApply 内で調整可)
  baseTurns?: number; // undefined -> 無限
  // ダメージ率寄与: 個々が加算で寄与し合計後 clamp(0,1) などするための情報
  // guard などは物理カット率へ 0.5 ではなく 0.5(=50%カット) を直接寄与
  physCutRate?: (actor: Actor, inst: StatusInstance) => number; // 0~1 追加
  psyCutRate?: (actor: Actor, inst: StatusInstance) => number; // 0~1 追加
  physUpRate?: (actor: Actor, inst: StatusInstance) => number; // 0~n 追加
  psyUpRate?: (actor: Actor, inst: StatusInstance) => number; // 0~n 追加
  // UI 用: バッジ色 (Tailwind クラス)
  badgeClass?: string;
}

export interface StatusInstance {
  id: StatusId;
  remainingTurns?: number; // undefined: 永続
  // 追加パラメータ (毒ダメージなど)
  data?: Record<string, unknown>;
}

// ---- 定義一覧 ----
export const STATUS_DEFS: Record<StatusId, StatusDefinition> = {
  guard: {
    id: 'guard',
    name: 'ガード',
    description: '次のターン開始まで物理ダメージ50% (ターン開始時解除)',
    baseTurns: 1, // 1ターン(現在ターン終了まで)
    // 多重付与可: ガードを複数持つと 0.5^n で軽減が強化 / カット率も加算 (上限 0.9)
    physicalDamageMultiplier: () => 0.5,
    physCutRate: () => 0.5, // 50%カット
    badgeClass: 'bg-green-700/70 border-green-300',
    onTurnEnd: (_actor, inst) => {
      if (inst.remainingTurns !== undefined) inst.remainingTurns -= 1;
    }
  },
  poison: {
    id: 'poison',
    name: '毒',
    description: 'ターン終了時に3ダメージ (3ターン)',
    baseTurns: 3,
    // 毒は多重化: 残ターンが異なる個別インスタンスとして保持
    badgeClass: 'bg-purple-700/70 border-purple-300',
    onTurnEnd: (actor, inst) => {
      const dmg = 3; // 現仕様固定
      actor.hp -= dmg;
      inst.remainingTurns = (inst.remainingTurns ?? 0) - 1;
    }
  },
  attackUp: {
    id: 'attackUp',
    name: '攻撃力上昇',
    description: '物理攻撃力+2 (3ターン)',
    baseTurns: 3,
    // 攻撃上昇も個別インスタンス化 (1インスタンス=+20%)
    badgeClass: 'bg-orange-600/70 border-orange-300',
    physUpRate: () => 0.2
  }
};

export function createStatus(id: StatusId): StatusInstance {
  const def = STATUS_DEFS[id];
  return { id, remainingTurns: def.baseTurns };
}

export function findStatus(actor: Actor, id: StatusId) {
  return actor.statuses.find((s) => s.id === id);
}

export function addStatus(actor: Actor, id: StatusId) {
  const def = STATUS_DEFS[id];
  const inst: StatusInstance = { id, remainingTurns: def.baseTurns };
  def.onApply?.(actor, inst, undefined);
  if (inst.remainingTurns === undefined || inst.remainingTurns > 0) actor.statuses.push(inst);
  recalcCombatRates(actor);
}

export function removeStatus(actor: Actor, id: StatusId) {
  // 指定IDを全削除 (プレイヤー/敵ターン開始時のガード解除など一括用途)
  for (const inst of actor.statuses.filter((s) => s.id === id)) {
    const def = STATUS_DEFS[id];
    def.onRemove?.(actor, inst);
  }
  actor.statuses = actor.statuses.filter((s) => s.id !== id);
  recalcCombatRates(actor);
}

export function removeStatusInstance(actor: Actor, inst: StatusInstance) {
  // 単一インスタンスのみ除去 (ターン経過での自然消滅用)
  const def = STATUS_DEFS[inst.id];
  def.onRemove?.(actor, inst);
  actor.statuses = actor.statuses.filter((s) => s !== inst);
}

export function tickStatusesEndTurn(actor: Actor) {
  // 各インスタンスごとにターン終了処理→期限切れのみ個別削除
  for (const inst of [...actor.statuses]) {
    const def = STATUS_DEFS[inst.id];
    def.onTurnEnd?.(actor, inst);
    if (inst.remainingTurns !== undefined && inst.remainingTurns <= 0) {
      removeStatusInstance(actor, inst);
    }
  }
  recalcCombatRates(actor);
}

export function physicalDamageMultiplier(actor: Actor): number {
  let mult = 1;
  for (const inst of actor.statuses) {
    const def = STATUS_DEFS[inst.id];
    if (def.physicalDamageMultiplier) {
      mult *= def.physicalDamageMultiplier(actor, inst);
    }
  }
  return mult;
}

// 追加されたレートフィールドを statuses から再計算
export function recalcCombatRates(actor: Actor) {
  let physCut = 0;
  let psyCut = 0;
  let physUp = 0;
  let psyUp = 0;
  for (const inst of actor.statuses) {
    const def = STATUS_DEFS[inst.id];
    if (def.physCutRate) physCut += def.physCutRate(actor, inst);
    if (def.psyCutRate) psyCut += def.psyCutRate(actor, inst);
    if (def.physUpRate) physUp += def.physUpRate(actor, inst);
    if (def.psyUpRate) psyUp += def.psyUpRate(actor, inst);
  }
  // カットは最大 0.9 (90%カット) までに制限
  actor.physDamageCutRate = Math.min(physCut, 0.9);
  actor.psyDamageCutRate = Math.min(psyCut, 0.9);
  actor.physDamageUpRate = physUp; // 上限は現仕様なし
  actor.psyDamageUpRate = psyUp;
}
