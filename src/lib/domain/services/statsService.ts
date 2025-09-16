import type { Actor } from '../entities/character';

export function calcMaxHP(actor: Actor): number {
  return 10 + actor.CON * 5;
}
