export type Phase = 'progress' | 'combat' | 'event' | 'rest' | 'reward' | 'victory' | 'gameover';

export interface Player {
  maxHP: number;
  hp: number;
  attack: number;
  actions: ActionId[];
  guard: boolean; // このターン防御中
  dots: DotEffect[];
  score: number; // 倒した敵数
}

export interface Enemy {
  kind: 'normal' | 'boss';
  baseHP: number;
  hp: number;
  attack: number;
  buffAttack?: number; // ボスバフ蓄積
}

export interface DotEffect {
  id: string;
  damage: number;
  turns: number;
}

export type ActionId = 'strike' | 'heavy' | 'guard' | 'recover' | 'poison' | 'powerup';

export interface ActionDef {
  id: ActionId;
  name: string;
  description: string;
  execute(state: GameState, ctx: { player: Player; enemy?: Enemy }): void;
  allowInCombat?: boolean; // combat以外で使えるもの将来用
  cooldownTurns?: number; // heavy等
}

export interface EventDef {
  id: string;
  name: string;
  description: string;
  apply(state: GameState): void;
}

export interface LogEntry {
  message: string;
  kind: 'system' | 'combat' | 'event' | 'rest';
}

export interface RewardOption {
  id: string;
  label: string;
  kind: 'normal' | 'boss';
  apply(state: GameState): void;
}

export interface GameState {
  floorIndex: number; // 0-9
  stepIndex: number; // 0-4
  phase: Phase;
  player: Player;
  enemy?: Enemy;
  actionOffer: ActionId[]; // 今ターン提供中
  actionUseCount: number; // このターン使用した回数 (2でターン終了)
  log: LogEntry[];
  highestFloor: number; // LocalStorage
  rngSeed?: number;
  rewardOptions?: RewardOption[]; // 成長候補
  rewardIsBoss?: boolean; // ボス撃破報酬か
  rewardIsFinalBoss?: boolean; // 最終ボス
}

export interface Scaling {
  enemyHP(base: number, floorIndex: number): number;
  enemyAttack(base: number, floorIndex: number): number;
}
