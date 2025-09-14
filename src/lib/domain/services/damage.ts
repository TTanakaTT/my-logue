import type { Actor } from '../entities/character';
import type { GameState } from '../entities/battleState';

export function applyDamage(
  _state: GameState,
  _source: Actor,
  target: Actor | undefined,
  amount: number
) {
  if (!target) return undefined;
  let final = amount;
  if (target.guard) {
    final = Math.ceil(final / 2);
    target.guard = false;
  }
  target.hp -= final;
  return final;
}
