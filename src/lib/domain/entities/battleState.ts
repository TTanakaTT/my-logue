import type { Player, Actor, ActorSide, ActorKind } from './character';
import type { ActionId } from '$lib/data/consts/actionIds';

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
  actionOffer: ActionId[];
  actionUseCount: number;
  playerUsedActions?: ActionId[];
  log: LogEntry[];
  highestFloor: number;
  rngSeed?: number;
  rewardOptions?: RewardOption[];
  rewardIsBoss?: boolean;
  rewardIsFinalBoss?: boolean;
}

export interface Scaling {
  enemyHP(base: number, floorIndex: number): number;
  enemyAttack(base: number, floorIndex: number): number;
}
