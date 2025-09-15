import type { actionName } from '$lib/domain/entities/actionName';

export type ActorKind = 'normal' | 'elite' | 'boss' | 'player';
export const ACTOR_KINDS: ActorKind[] = ['normal', 'elite', 'boss', 'player'];
export type ActorSide = 'player' | 'enemy';

export interface BuffState {
  attackBonus?: number;
}

export interface DotEffect {
  id: string;
  damage: number;
  turns: number;
}

export interface Actor {
  kind: ActorKind;
  side: ActorSide;
  name: string;
  STR: number;
  CON: number;
  POW: number;
  DEX: number;
  APP: number;
  INT: number;
  hp: number;
  guard: boolean;
  dots: DotEffect[];
  buffs?: BuffState;
  actions: actionName[];
  revealed?: Partial<Record<StatKey, boolean>>;
  /**
   * 敵専用: 戦闘中にプレイヤーへ公開済み（=使用済み）アクションID一覧。
   * プレイヤー側は不要なので省略可。
   */
  revealedActions?: actionName[];
  maxActionsPerTurn: number;
  maxActionChoices: number;
}

export interface Player extends Actor {
  score: number;
}

export type StatKey = 'hp' | 'CON' | 'STR' | 'POW' | 'DEX' | 'APP' | 'INT';
