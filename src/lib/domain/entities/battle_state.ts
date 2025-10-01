import type {
  Actor,
  ActorSide,
  ActorKind,
  Player,
  Enemy,
  Character
} from '$lib/domain/entities/character';
import type { Action } from '$lib/domain/entities/action';

export type Phase =
  | 'companion_select'
  | 'progress'
  | 'combat'
  | 'event'
  | 'rest'
  | 'reward'
  | 'victory'
  | 'gameover';
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
  /** 前周回から引き継いだ仲間候補 (ゲーム開始直後 companion_select フェーズで表示) */
  companionCandidates?: Character[];
  /** プレイヤー名確定済みか */
  playerNameCommitted?: boolean;
  allies: Actor[];
  enemies: Enemy[];
  selectedEnemyIndex?: number;
  actionOffer: Action[];
  actionUseCount: number;
  playerUsedActions?: Action[];
  log: LogEntry[];
  highestFloor: number;
  rngSeed?: number;
  rewardOptions?: RewardOption[];
  rewardIsBoss?: boolean;
  currentEncounterKind?: 'normal' | 'elite' | 'boss';
  /** 洞察で確認し報酬候補化するアクション */
  insightRewardActions?: Action[];
}
