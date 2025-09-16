import type { Actor } from '../entities/character';

export function applyDamage(_source: Actor, target: Actor | undefined, amount: number) {
  if (!target) return undefined;
  let damage = amount;
  if (target.guard) {
    damage = Math.ceil(damage / 2);
  }
  target.hp -= damage;
  return damage;
}
