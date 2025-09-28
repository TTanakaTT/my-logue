import type { GameState } from './BattleState';
import type { Actor } from './Character';
import type { action } from '../../data/consts/actions';

/**
 * アクション定義。
 * クリティカル要素追加に伴い以下を追加/変更。
 * - normalAction / criticalAction: それぞれ通常時とクリティカル時の処理。
 * - normalLog / criticalLog: ログ文言分岐。
 * 既存の execute / log は後方互換用 (旧定義移行期間) として残すが新規追加禁止。
 */
export interface ActionDef {
  name: string;
  description: string;
  /** 通常時の処理 (未指定なら空挙動) */
  normalAction(ctx: { actor: Actor; target?: Actor }): void;
  /** クリティカル時の処理 (未指定時は normalAction をフォールバック) */
  criticalAction(ctx: { actor: Actor; target?: Actor }): void;
  allowInCombat?: boolean;
  cooldownTurns?: number;
  /** 通常ログ */
  normalLog(ctx: { actor: Actor; target?: Actor; state?: GameState }): string;
  /** クリティカルログ (未指定時は normalLog) */
  criticalLog(ctx: { actor: Actor; target?: Actor; state?: GameState }): string;
}

export type Action = keyof typeof action;
