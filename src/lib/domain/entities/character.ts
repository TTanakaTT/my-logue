import type { Action } from '$lib/domain/entities/action';
import type { StatusInstance } from '$lib/domain/entities/status';

export type ActorKind = 'normal' | 'elite' | 'boss' | 'player';
export const ACTOR_KINDS: ActorKind[] = ['normal', 'elite', 'boss', 'player'];
export type ActorSide = 'player' | 'enemy';

/**
 * アクター (プレイヤー/敵) の共通型。
 * すべての一時効果は statuses に集約。
 */
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
  statuses: StatusInstance[];
  /** 物理ダメージカット率 (0~1) */
  physDamageCutRate: number;
  /** 精神ダメージカット率 (0~1) */
  psyDamageCutRate: number;
  /** 物理与ダメアップ率 (加算) */
  physDamageUpRate: number;
  /** 精神与ダメアップ率 (加算) */
  psyDamageUpRate: number;
  actions: Action[];
  /** 公開済み能力値 */
  revealed?: Partial<Record<StatKey, boolean>>;
  /** 使用により観測されたアクションID */
  revealedActions?: Action[];
  /** 洞察で開示されたアクションID */
  insightActions?: Action[];
  /** 1ターンに使用できる最大アクション数 */
  maxActionsPerTurn: number;
  /** 戦闘開始時に提示されるアクション選択肢数 */
  maxActionChoices: number;
}

export interface Player extends Actor {
  score: number;
}

export type StatKey = 'hp' | 'CON' | 'STR' | 'POW' | 'DEX' | 'APP' | 'INT';
