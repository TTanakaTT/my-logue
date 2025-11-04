import type { Actor } from '$lib/domain/entities/character';
import type { status } from '$lib/data/consts/statuses';

export interface StatusDef {
  name: string; // UI表示
  description: string;
  /** Material Symbols icon name for UI (outlined set). */
  icon?: string;
  /** ターン開始時に呼ばれる継続効果 */
  apply?: (actor: Actor) => void;
  /** 継続ターン (undefined: 永続) */
  ContinuousTurns?: number;
  /** 付与即時にも apply を 1 回実行するか */
  Immediate: boolean;
  badgeClass?: string; // UI用
}

export interface StatusInstance {
  id: Status;
  /** 残ターン (undefined は永続) */
  remainingTurns?: number;
}
export function isStatusInstance(value: unknown): value is StatusInstance {
  return true;
}

export type Status = keyof typeof status;
