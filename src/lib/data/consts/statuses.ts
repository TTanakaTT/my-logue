import type { Actor } from '$lib/domain/entities/character';
import type {
  DamageKind,
  Status,
  StatusApplyContext,
  StatusDef,
  StatusInstance,
  StatusIncomingDamageContext,
  StatusLifecycleContext
} from '$lib/domain/entities/status';

function decrementCount(instance: StatusInstance, amount = 1) {
  instance.count = Math.max(0, instance.count - amount);
}

export const status = {
  Guard: {
    name: 'ガード',
    icon: 'shield',
    description: '物理ダメージを軽減する。被弾時にカウントが減少する',
    badgeClass: 'bg-green-700/70 border-green-300',
    onApply: ({ instance, count }: StatusApplyContext) => {
      if (typeof count === 'number') {
        instance.count += count;
      }
    },
    recompute: ({ actor, instance }: StatusLifecycleContext) => {
      const rate = (instance.count * 2) / 100;
      actor.physDefenseUpRate += rate;
    },
    onIncomingDamage: (context: StatusIncomingDamageContext) => {
      const { instance, rawAmount, kind } = context;
      if (instance.count <= 0 || rawAmount <= 0) return;

      if (kind === 'physical') {
        instance.count = Math.max(0, instance.count - rawAmount);
      }
    },
    onBattleEnd: ({ instance }: StatusLifecycleContext) => {
      instance.count = 0;
    }
  },
  MindBarrier: {
    name: '精神障壁',
    icon: 'psychology',
    description: '精神ダメージを軽減する。被弾時にカウントが減少する',
    badgeClass: 'bg-purple-700/70 border-purple-300',
    onApply: ({ instance, count }: StatusApplyContext) => {
      if (typeof count === 'number') {
        instance.count += count;
      }
    },
    recompute: ({ actor, instance }: StatusLifecycleContext) => {
      const rate = (instance.count * 2) / 100;
      actor.psyDefenseUpRate += rate;
    },
    onIncomingDamage: (context: StatusIncomingDamageContext) => {
      const { instance, rawAmount, kind } = context;
      if (instance.count <= 0 || rawAmount <= 0) return;

      if (kind === 'psychic') {
        instance.count = Math.max(0, instance.count - rawAmount);
      }
    },
    onBattleEnd: ({ instance }: StatusLifecycleContext) => {
      instance.count = 0;
    }
  },
  IronWill: {
    name: '鉄の意志',
    icon: 'security',
    description: '物理・精神ダメージを軽減する。被弾時にカウントが減少する',
    badgeClass: 'bg-gray-700/70 border-gray-300',
    onApply: ({ instance, count }: StatusApplyContext) => {
      if (typeof count === 'number') {
        instance.count += count;
      }
    },
    recompute: ({ actor, instance }: StatusLifecycleContext) => {
      const rate = instance.count / 100;
      actor.physDefenseUpRate += rate;
      actor.psyDefenseUpRate += rate;
    },
    onIncomingDamage: (context: StatusIncomingDamageContext) => {
      const { instance, rawAmount } = context;
      if (instance.count <= 0 || rawAmount <= 0) return;
      instance.count = Math.max(0, instance.count - rawAmount);
    },
    onBattleEnd: ({ instance }: StatusLifecycleContext) => {
      instance.count = 0;
    }
  },
  MuscleUp: {
    name: '筋力増強',
    icon: 'fitness_center',
    description: '物理与ダメージが上昇する。ターン終了時にカウントが減少する',
    badgeClass: 'bg-red-700/70 border-red-300',
    onApply: ({ instance, count }: StatusApplyContext) => {
      if (typeof count === 'number') {
        instance.count += count;
      }
    },
    recompute: ({ actor, instance }: StatusLifecycleContext) => {
      const rate = instance.count / 100;
      actor.physDamageUpRate += rate;
    },
    onTurnEnd: ({ instance }: StatusLifecycleContext) => {
      decrementCount(instance);
    },
    onBattleEnd: ({ instance }: StatusLifecycleContext) => {
      instance.count = 0;
    }
  },
  MindUp: {
    name: '精神統一',
    icon: 'self_improvement',
    description: '精神与ダメージが上昇する。ターン終了時にカウントが減少する',
    badgeClass: 'bg-indigo-700/70 border-indigo-300',
    onApply: ({ instance, count }: StatusApplyContext) => {
      if (typeof count === 'number') {
        instance.count += count;
      }
    },
    recompute: ({ actor, instance }: StatusLifecycleContext) => {
      const rate = instance.count / 100;
      actor.psyDamageUpRate += rate;
    },
    onTurnEnd: ({ instance }: StatusLifecycleContext) => {
      decrementCount(instance);
    },
    onBattleEnd: ({ instance }: StatusLifecycleContext) => {
      instance.count = 0;
    }
  },
  OverDrive: {
    name: 'オーバードライブ',
    icon: 'bolt',
    description: '物理・精神与ダメージが上昇する。ターン終了時にカウントが減少する',
    badgeClass: 'bg-orange-700/70 border-orange-300',
    onApply: ({ instance, count }: StatusApplyContext) => {
      if (typeof count === 'number') {
        instance.count += count;
      }
    },
    recompute: ({ actor, instance }: StatusLifecycleContext) => {
      const rate = instance.count / 100;
      actor.physDamageUpRate += rate;
      actor.psyDamageUpRate += rate;
    },
    onTurnEnd: ({ instance }: StatusLifecycleContext) => {
      decrementCount(instance);
    },
    onBattleEnd: ({ instance }: StatusLifecycleContext) => {
      instance.count = 0;
    }
  }
} satisfies Record<string, StatusDef>;

export function createStatus(id: Status): StatusInstance {
  return { id, count: 0 };
}

export function findStatus(actor: Actor, id: Status) {
  normalizeStatuses(actor);
  return actor.statuses.find((s) => s.id === id);
}

export function addStatus(actor: Actor, id: Status, count?: number) {
  normalizeStatuses(actor);
  const def = status[id];
  if (!def) return;
  let inst = actor.statuses.find((s) => s.id === id);
  if (!inst) {
    inst = { id, count: 0 };
    actor.statuses.push(inst);
  }
  def.onApply?.({ actor, instance: inst, count });
  cleanupStatuses(actor);
  recomputeStatusEffects(actor);
}

export function removeStatus(actor: Actor, id: Status) {
  normalizeStatuses(actor);
  actor.statuses = actor.statuses.filter((s) => s.id !== id);
  recomputeStatusEffects(actor);
}

export function removeStatusInstance(actor: Actor, inst: StatusInstance) {
  normalizeStatuses(actor);
  actor.statuses = actor.statuses.filter((s) => s !== inst);
  recomputeStatusEffects(actor);
}

export function tickStatusesTurnStart(actor: Actor) {
  normalizeStatuses(actor);
  recomputeStatusEffects(actor);
  const entries = [...actor.statuses];
  for (const inst of entries) {
    (status[inst.id] as StatusDef).onTurnStart?.({ actor, instance: inst });
  }
  cleanupStatuses(actor);
  recomputeStatusEffects(actor);
}

export function tickStatusesTurnEnd(actor: Actor) {
  normalizeStatuses(actor);
  const entries = [...actor.statuses];
  for (const inst of entries) {
    (status[inst.id] as StatusDef).onTurnEnd?.({ actor, instance: inst });
  }
  cleanupStatuses(actor);
  recomputeStatusEffects(actor);
}
export function onBattleEnd(actor: Actor) {
  normalizeStatuses(actor);
  const entries = [...actor.statuses];
  for (const inst of entries) {
    (status[inst.id] as StatusDef).onBattleEnd?.({ actor, instance: inst });
  }
  cleanupStatuses(actor);
  recomputeStatusEffects(actor);
}

export function onIncomingDamage(
  actor: Actor,
  amount: number,
  rawAmount: number,
  kind: DamageKind,
  source: Actor
) {
  normalizeStatuses(actor);
  for (const inst of [...actor.statuses]) {
    const def = status[inst.id] as StatusDef | undefined;
    if (!def || typeof def.onIncomingDamage !== 'function') continue;
    def.onIncomingDamage({ actor, instance: inst, source, amount, rawAmount, kind });
  }
  cleanupStatuses(actor);
  recomputeStatusEffects(actor);
}

function recomputeStatusEffects(actor: Actor) {
  resetStatusesEffects(actor);
  for (const inst of actor.statuses) {
    (status[inst.id] as StatusDef).recompute?.({ actor, instance: inst });
  }
}

function cleanupStatuses(actor: Actor) {
  actor.statuses = actor.statuses.filter((inst) => inst.count > 0 && status[inst.id]);
  actor.statuses.sort((a, b) => a.id.localeCompare(b.id));
}

function normalizeStatuses(actor: Actor) {
  if (!Array.isArray(actor.statuses)) {
    actor.statuses = [];
    return;
  }
  const merged = new Map<Status, number>();
  for (const raw of actor.statuses) {
    if (!raw) continue;
    const id = raw.id as Status;
    if (!id || !status[id]) continue;
    const count = raw.count;

    if (typeof count !== 'number' || !Number.isFinite(count)) continue;
    const normalized = Math.max(0, Math.floor(count));
    if (normalized <= 0) continue;
    merged.set(id, (merged.get(id) || 0) + normalized);
  }
  actor.statuses = Array.from(merged.entries()).map(([id, count]) => ({ id, count }));
  actor.statuses.sort((a, b) => a.id.localeCompare(b.id));
}

function resetStatusesEffects(actor: Actor) {
  actor.physDamageUpRate = 0;
  actor.physDefenseUpRate = 0;
  actor.psyDamageUpRate = 0;
  actor.psyDefenseUpRate = 0;
}
