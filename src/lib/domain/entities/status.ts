import type { Actor } from '$lib/domain/entities/character';
import type { status } from '$lib/data/consts/statuses';

export interface StatusLifecycleContext {
  actor: Actor;
  instance: StatusInstance;
}

export type DamageKind = 'physical' | 'psychic';

export interface StatusIncomingDamageContext extends StatusLifecycleContext {
  source: Actor;
  amount: number;
  rawAmount: number;
  kind: DamageKind;
}

export interface StatusApplyContext extends StatusLifecycleContext {
  count?: number;
}

export interface StatusDef {
  name: string;
  description: string;
  /** Material Symbols icon name for UI (outlined set). */
  icon?: string;
  onApply?: (context: StatusApplyContext) => void;
  onTurnStart?: (context: StatusLifecycleContext) => void;
  onTurnEnd?: (context: StatusLifecycleContext) => void;
  onBattleEnd?: (context: StatusLifecycleContext) => void;
  recompute?: (context: StatusLifecycleContext) => void;
  onIncomingDamage?: (context: StatusIncomingDamageContext) => void;
  badgeClass?: string;
}

export interface StatusInstance {
  id: Status;
  count: number;
}
export function isStatusInstance(value: unknown): value is StatusInstance {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string') return false;
  if (typeof record.count === 'number') return true;
  return false;
}

export type Status = keyof typeof status;
