import type { Action } from '$lib/domain/entities/Action';
import type { StatusInstance } from './Status';

export type ActorKind = 'normal' | 'elite' | 'boss' | 'player';
export const ACTOR_KINDS: ActorKind[] = ['normal', 'elite', 'boss', 'player'];
export type ActorSide = 'player' | 'enemy';

// guard / 毒 / バフ など全ての一時効果は statuses (StatusInstance[]) に統合。

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
  /** 物理ダメージカット率 (0~1)。0.2 なら最終的に 20% 軽減。複数ステは加算後 1 上限 */
  physDamageCutRate: number;
  /** 精神ダメージカット率 (0~1) */
  psyDamageCutRate: number;
  /** 物理ダメージアップ率 (0~n)。0.3 なら +30% (加算) */
  physDamageUpRate: number;
  /** 精神ダメージアップ率 (0~n) */
  psyDamageUpRate: number;
  actions: Action[];
  revealed?: Partial<Record<StatKey, boolean>>;
  /**
   * 敵専用: 戦闘中にプレイヤーへ公開済み（=使用済み）アクションID一覧。
   * プレイヤー側は不要なので省略可。
   */
  revealedActions?: Action[];
  /**
   * 敵専用: 洞察(Insight/Reveal)により開示されたアクションID一覧。
   * 観測(使用による開示)と区別するため別管理する。
   */
  insightActions?: Action[];
  maxActionsPerTurn: number;
  maxActionChoices: number;
}

export interface Player extends Actor {
  score: number;
}

export type StatKey = 'hp' | 'CON' | 'STR' | 'POW' | 'DEX' | 'APP' | 'INT';
