import type { Action } from '$lib/domain/entities/action';
import { isStatusInstance, type StatusInstance } from '$lib/domain/entities/status';

export const ACTOR_KINDS = ['normal', 'elite', 'boss', 'player'];
export type ActorKind = (typeof ACTOR_KINDS)[number];

export function isActorKind(value: unknown): value is ActorKind {
  return typeof value === 'string' && (ACTOR_KINDS as readonly string[]).includes(value);
}

export const ACTOR_SIDES = ['player', 'enemy'];
export type ActorSide = (typeof ACTOR_SIDES)[number];

export function isActorSide(value: unknown): value is ActorSide {
  return typeof value === 'string' && (ACTOR_SIDES as readonly string[]).includes(value);
}

// キャラクターの能力値キー一覧（表示/加算処理で使用）
export const CHARACTER_ATTRIBUTES = [
  'STR',
  'CON',
  'POW',
  'DEX',
  'APP',
  'INT',
  'maxActionsPerTurn'
] as const;
export type CharacterAttributeKey = (typeof CHARACTER_ATTRIBUTES)[number];

export interface CharacterAttribute {
  STR: number;
  CON: number;
  POW: number;
  DEX: number;
  APP: number;
  INT: number;
  /** 1ターンに使用できる最大アクション数 */
  maxActionsPerTurn: number;
}
export interface Character {
  id: string;
  name: string;
  characterAttributes: CharacterAttribute;
  actions: Action[];
}

/**
 * アクター (プレイヤー/敵) の共通型。
 * すべての一時効果は statuses に集約。
 */
export interface Actor extends Character {
  kind: ActorKind;
  side: ActorSide;
  hp: number;
  statuses: StatusInstance[];
  /** 補正前能力値 */
  baseAttributes: Character;
  /** 所持している鉱石のID一覧 */
  heldMineralIds: string[];
  /** 物理ダメージカット率 (0~1) */
  physDamageCutRate: number;
  /** 精神ダメージカット率 (0~1) */
  psyDamageCutRate: number;
  /** 物理与ダメアップ率 (加算) */
  physDamageUpRate: number;
  /** 精神与ダメアップ率 (加算) */
  psyDamageUpRate: number;
}

export function isActor(value: Character): value is Enemy {
  if (typeof value !== 'object' || !value) return false;

  const {
    kind,
    side,
    hp,
    statuses,
    physDamageCutRate,
    psyDamageCutRate,
    physDamageUpRate,
    psyDamageUpRate
  } = value as Record<keyof Actor, unknown>;

  return (
    isActorKind(kind) &&
    isActorSide(side) &&
    typeof hp === 'number' &&
    Array.isArray(statuses) &&
    statuses.every((s) => isStatusInstance(s)) &&
    typeof physDamageCutRate === 'number' &&
    typeof psyDamageCutRate === 'number' &&
    typeof physDamageUpRate === 'number' &&
    typeof psyDamageUpRate === 'number'
  );
}

export interface Player extends Actor {
  /** 戦闘開始時に提示されるアクション選択肢数 */
  maxActionChoices: number;
}

export function isPlayer(value: Actor): value is Player {
  if (typeof value !== 'object' || !value) {
    return false;
  }
  const { maxActionChoices } = value as Record<keyof Player, unknown>;
  return typeof maxActionChoices === 'number';
}

export interface Enemy extends Actor {
  /** 情報開示済み */
  isExposed: boolean;
  /** 公開済み能力値 */
  revealedAttributes?: Attribute[];
  /** 使用により観測されたアクションID */
  observedActions?: Action[];
}

export function isEnemy(value: Actor): value is Enemy {
  if (typeof value !== 'object' || !value) {
    return false;
  }
  const { isExposed } = value as Record<keyof Enemy, unknown>;

  return typeof isExposed === 'boolean';
}

export type ActorAttribute = 'hp';
export type Attribute = CharacterAttributeKey | ActorAttribute;
