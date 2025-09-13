import type { Actor } from './types';

// 派生計算式（バランス調整しやすいよう一元管理）
export function calcMaxHP(actor: Actor): number {
  return 10 + actor.CON * 5;
}

export function heal(actor: Actor, amount: number) {
  const max = calcMaxHP(actor);
  actor.hp = Math.min(max, actor.hp + amount);
}

export function damage(actor: Actor, amount: number) {
  actor.hp -= amount;
}

export function addAttackBuff(actor: Actor, amount: number) {
  if (!actor.buffs) actor.buffs = {};
  actor.buffs.attackBonus = (actor.buffs.attackBonus ?? 0) + amount;
}
