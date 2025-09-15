import type { Player, Actor, ActorSide, ActorKind } from './character';
import type { actionName } from '$lib/domain/entities/actionName';

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
  enemy?: Actor;
  actionOffer: actionName[];
  actionUseCount: number;
  playerUsedActions?: actionName[];
  log: LogEntry[];
  highestFloor: number;
  rngSeed?: number;
  rewardOptions?: RewardOption[];
  rewardIsBoss?: boolean;
}
