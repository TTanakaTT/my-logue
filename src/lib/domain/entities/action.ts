import type { GameState } from '$lib/domain/entities/battle_state';
import type { Actor } from '$lib/domain/entities/character';
import { action } from '$lib/data/consts/actions';

/**
 * Action definition.
 * With critical hits introduced, behavior and logs can branch between normal and critical.
 */
export interface ActionDef {
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Behavior when normal */
  normalAction: (ctx: { actor: Actor; target?: Actor }) => void;
  /** Behavior when critical (defaults to normalAction if not specified) */
  criticalAction: (ctx: { actor: Actor; target?: Actor }) => void;
  /** Whether usable during combat (true by default) */
  allowInCombat?: boolean;
  /** Cooldown turns */
  cooldownTurns?: number;
  /** Normal log */
  normalLog: (ctx: { actor: Actor; target?: Actor; state?: GameState }) => string;
  /** Critical log */
  criticalLog: (ctx: { actor: Actor; target?: Actor; state?: GameState }) => string;
}

/** Action ID (keys of the actions definition) */
export type Action = keyof typeof action;

/**
 * Type guard that checks whether a string corresponds to a known Action identifier.
 *
 * @param value - The candidate action identifier (whitespace will be trimmed).
 * @returns True if the trimmed string matches an own property key on the `action` object;
 *          when true, TypeScript will narrow the type of `value` to `Action`.
 */
export function isActionId(value: unknown): value is Action {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(action, value.trim());
}
