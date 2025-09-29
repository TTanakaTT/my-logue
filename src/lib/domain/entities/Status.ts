import type { Actor } from '$lib/domain/entities/Character';

import type { status } from '$lib/data/consts/statuses';

export interface StatusDef {
  name: string; // UI表示
  description: string;
  apply?: (actor: Actor) => void; // ターン開始時処理(継続効果)
  ContinuousTurns?: number; // 継続ターン
  /** 即時効果フラグ: true なら付与直後にも apply を一度実行 */
  Immediate: boolean;
  badgeClass?: string; // UI
}
export interface StatusInstance {
  id: Status;
  remainingTurns?: number; // undefined: 永続
}

export type Status = keyof typeof status;
