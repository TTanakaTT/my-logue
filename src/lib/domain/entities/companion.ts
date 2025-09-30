import type { Action } from '$lib/domain/entities/action';

/**
 * ゲームオーバー時に保存される仲間候補(元プレイヤー)のスナップショット。
 * ラン (周回) を跨いで最大3体まで保持し、次回開始時にプレイヤーの初期仲間として選択可能にする想定。
 * 状態は純粋データのみ (副作用/関数無し) で保存する。
 */
export interface CompanionSnapshot {
  /** 生成時刻 (ms) 用の簡易ID。重複回避 & 並び替え用途 */
  id: string;
  name: string;
  /** 能力値 */
  STR: number;
  CON: number;
  POW: number;
  DEX: number;
  APP: number;
  INT: number;
  /** 1ターン最大行動数 */
  maxActionsPerTurn: number;
  /** 行動候補数 */
  maxActionChoices: number;
  /** 習得済アクション一覧 */
  actions: Action[];
}
