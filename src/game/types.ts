export type Phase = 'progress' | 'combat' | 'event' | 'rest' | 'reward' | 'victory' | 'gameover';

// すべての戦闘参加キャラクター共通
export type ActorKind = 'normal' | 'boss' | 'player';
export const ACTOR_KINDS: ActorKind[] = ['normal', 'boss', 'player'];
export type ActorSide = 'player' | 'enemy';
export type RewardKind = 'normal' | 'boss';

export interface Actor {
  kind: ActorKind;
  side: ActorSide;
  name: string; // 表示名 (CSV 定義)
  // 基礎能力値
  STR: number;
  CON: number;
  POW: number;
  DEX: number;
  APP: number;
  INT: number;
  // 現在HP (最大HPは CON から計算するので保持しない)
  hp: number;
  // 共通状態
  guard: boolean; // 次の被ダメ軽減など
  dots: DotEffect[]; // 付与されたDoT/状態
  buffs?: BuffState; // 量的バフ（攻撃上昇など）
  actions: ActionId[]; // 利用可能アクション (敵味方共通)
  revealed?: Partial<Record<StatKey, boolean>>; // 情報開示状態
  maxActionsPerTurn: number; // 1 or 2 etc
  maxActionChoices: number; // そのターン提示される選択肢数上限
}

export type StatKey = 'hp' | 'CON' | 'STR' | 'POW' | 'DEX' | 'APP' | 'INT';

export interface BuffState {
  attackBonus?: number; // STR起点攻撃の加算
}

export interface Player extends Actor {
  score: number;
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
  execute(state: GameState, ctx: { actor: Actor; target?: Actor }): void;
  allowInCombat?: boolean; // combat以外で使えるもの将来用
  cooldownTurns?: number; // heavy等
  /**
   * ログ生成関数。任意。返り値が undefined の場合ログは出さない。
   * 文字列はそのまま combat ログに出力される。
   */
  log?: (ctx: { actor: Actor; target?: Actor; state: GameState }) => string | undefined;
}

export interface EventDef {
  id: string;
  name: string;
  description: string;
  apply(state: GameState): void;
}

export const LOG_KINDS = ['system', 'combat', 'event', 'rest'] as const;

export type LogKind = (typeof LOG_KINDS)[number];
export interface LogEntry {
  message: string;
  kind: LogKind;
  side?: ActorSide; // 行動主体のサイド
  actorKind?: ActorKind; // ボス表示など差別化用
}

export interface RewardOption {
  id: string;
  label: string;
  kind: RewardKind;
  apply(state: GameState): void;
}

export interface GameState {
  floorIndex: number; // 0-9
  stepIndex: number; // 0-4
  phase: Phase;
  player: Player;
  enemy?: Actor;
  actionOffer: ActionId[]; // 今ターン提供中
  actionUseCount: number; // このターン使用した回数 (2でターン終了)
  playerUsedActions?: ActionId[]; // 今ターンプレイヤーが既に使ったアクション (重複防止/グレーアウト)
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
