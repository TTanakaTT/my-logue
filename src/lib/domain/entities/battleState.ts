import type { Player, Actor, ActorSide, ActorKind } from './Character';
import type { Action } from '$lib/domain/entities/Action';

export type Phase = 'progress' | 'combat' | 'event' | 'rest' | 'reward' | 'victory' | 'gameover';
export type RewardKind = 'normal' | 'boss';

export interface LogEntry {
  message: string;
  kind: LogKind;
  side?: ActorSide;
  actorKind?: ActorKind;
}

export const LOG_KINDS = ['system', 'combat', 'event', 'rest'] as const;
export type LogKind = (typeof LOG_KINDS)[number];

export interface RewardOption {
  id: string;
  label: string;
  kind: RewardKind;
  apply(state: GameState): void;
}

export interface GameState {
  floorIndex: number;
  stepIndex: number;
  phase: Phase;
  player: Player;
  /** 味方（プレイヤー以外） */
  allies: Actor[];
  /** 現在の戦闘中の敵（複数対応） */
  enemies: Actor[];
  /** プレイヤーが選択している攻撃対象（enemiesのインデックス） */
  selectedEnemyIndex?: number;
  actionOffer: Action[];
  actionUseCount: number;
  playerUsedActions?: Action[];
  log: LogEntry[];
  highestFloor: number;
  rngSeed?: number;
  rewardOptions?: RewardOption[];
  rewardIsBoss?: boolean;
  /** この戦闘の相手の種別（報酬判定用） */
  currentEncounterKind?: 'normal' | 'elite' | 'boss';
  /**
   * 洞察(Reveal)で確認した敵アクションの集合。戦闘終了時に報酬へ反映するための一時保管。
   * プレイヤーが既に所持しているものは報酬表示時に除外する。
   */
  insightRewardActions?: Action[];
}
