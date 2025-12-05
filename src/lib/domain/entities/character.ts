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

// List of character attribute keys (used for display / addition operations)
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
  /** Maximum number of actions usable per turn */
  maxActionsPerTurn: number;
}
export interface Character {
  id: string;
  name: string;
  characterAttributes: CharacterAttribute;
  actions: Action[];
}

/**
 * Common actor type (player / enemy).
 * All effects are gathered in `statuses`.
 */
export interface Actor extends Character {
  kind: ActorKind;
  side: ActorSide;
  hp: number;
  statuses: StatusInstance[];
  /** Base (unmodified) attributes */
  baseAttributes: Character;
  /** IDs of held minerals */
  heldMineralIds: string[];
  /** Physical damage increase rate (additive) */
  physDamageUpRate: number;
  /** Physical defense buff rate (additive) */
  physDefenseUpRate: number;
  /** Psychic damage increase rate (additive) */
  psyDamageUpRate: number;
  /** Psychic defense buff rate (additive) */
  psyDefenseUpRate: number;
}

export function isActor(value: Character): value is Enemy {
  if (typeof value !== 'object' || !value) return false;

  const {
    kind,
    side,
    hp,
    statuses,
    physDefenseUpRate,
    psyDefenseUpRate,
    physDamageUpRate,
    psyDamageUpRate
  } = value as Record<keyof Actor, unknown>;

  return (
    isActorKind(kind) &&
    isActorSide(side) &&
    typeof hp === 'number' &&
    Array.isArray(statuses) &&
    statuses.every((s) => isStatusInstance(s)) &&
    typeof physDefenseUpRate === 'number' &&
    typeof psyDefenseUpRate === 'number' &&
    typeof physDamageUpRate === 'number' &&
    typeof psyDamageUpRate === 'number'
  );
}

export interface Player extends Actor {
  /** Number of action choices presented at combat start */
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
  /** Whether the enemy's information has been revealed */
  isExposed: boolean;
  /** Attributes that have been revealed */
  revealedAttributes?: Attribute[];
  /** Action IDs observed through use */
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
