import { pushCombatLog } from '$lib/presentation/utils/logUtil';
import type { Actor } from '../entities/character';

export function applyPhysicalDamage(_source: Actor, target: Actor, amount: number) {
  let damage = amount;
  if (target.guard) {
    damage = Math.ceil(damage / 2);
  }
  return applyDamage(_source, target, damage);
}
export function applyPsychicDamage(_source: Actor, target: Actor, amount: number) {
  const damage = Math.max(1, amount - Math.floor(target.POW * 0.5));
  return applyDamage(_source, target, damage);
}

// 他のダメージタイプが増えた場合に備えて汎用的な damageType を受け取る形にしておく
function applyDamage(_source: Actor, target: Actor, amount: number) {
  target.hp -= amount;
  pushCombatLog(`${amount}のダメージ！`, _source.side, _source.kind);
  return amount;
}
