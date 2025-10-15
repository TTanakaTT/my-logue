import type { Action } from '$lib/domain/entities/action';

export const MINERAL_RARITIES = [1, 2, 3, 4, 5];
export type MineralRarity = (typeof MINERAL_RARITIES)[number];

export function isMineralRarity(value: unknown): value is MineralRarity {
  return typeof value === 'number' && (MINERAL_RARITIES as readonly number[]).includes(value);
}
export interface Mineral {
  id: string;
  name: string;
  rarity: MineralRarity;
  STR: number;
  CON: number;
  POW: number;
  DEX: number;
  APP: number;
  INT: number;
  maxActionsPerTurn: number;
  maxActionChoices: number;
  grantedActions: Action[];
}

/**
 * Type guard that determines whether a value matches the runtime shape of a Mineral.
 *
 * @param value - The value to test.
 * @returns True if `value` can be treated as a `Mineral` (narrowed by the predicate `value is Mineral`).
 *
 */
export function isMineral(value: unknown): value is Mineral {
  if (typeof value !== 'object' || !value) return false;
  const { id, name, rarity, STR, CON, POW, DEX, APP, INT, maxActionsPerTurn, maxActionChoices } =
    value as Record<keyof Mineral, unknown>;
  return (
    typeof id === 'string' &&
    typeof name === 'string' &&
    isMineralRarity(rarity) &&
    typeof STR === 'number' &&
    typeof CON === 'number' &&
    typeof POW === 'number' &&
    typeof DEX === 'number' &&
    typeof APP === 'number' &&
    typeof INT === 'number' &&
    typeof maxActionsPerTurn === 'number' &&
    typeof maxActionChoices === 'number'
  );
}
