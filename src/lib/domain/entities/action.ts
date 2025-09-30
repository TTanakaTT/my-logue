import type { GameState } from '$lib/domain/entities/battle_state';
import type { Actor } from '$lib/domain/entities/character';
import type { action } from '$lib/data/consts/actions';

/**
 * アクション定義。
 * クリティカル導入により normal/critical で挙動とログを分岐可能にする。
 */
export interface ActionDef {
  /** 表示名 */
  name: string;
  /** 説明文 */
  description: string;
  /** 通常時の処理 */
  normalAction: (ctx: { actor: Actor; target?: Actor }) => void;
  /** クリティカル時の処理 (未指定時は normalAction を再利用) */
  criticalAction: (ctx: { actor: Actor; target?: Actor }) => void;
  /** 戦闘中での使用可否 (未指定時 true) */
  allowInCombat?: boolean;
  /** クールダウンターン数 */
  cooldownTurns?: number;
  /** 通常ログ */
  normalLog: (ctx: { actor: Actor; target?: Actor; state?: GameState }) => string;
  /** クリティカルログ */
  criticalLog: (ctx: { actor: Actor; target?: Actor; state?: GameState }) => string;
}

/** アクションID (actions 定義キー) */
export type Action = keyof typeof action;
