import { pushCombatLog } from '$lib/presentation/utils/logUtil';
import type { Actor } from '../entities/Character';

export function applyPhysicalDamage(source: Actor, target: Actor, amount: number) {
  const up = source.physDamageUpRate || 0;
  const cut = target.physDamageCutRate || 0;
  const raw = amount * (1 + up) * (1 - cut);
  const damage = Math.max(1, raw);
  applyDamage(source, target, damage);
}
export function applyPsychicDamage(source: Actor, target: Actor, amount: number) {
  const base = Math.max(1, amount - target.POW * 0.5);
  const up = source.psyDamageUpRate || 0;
  const cut = target.psyDamageCutRate || 0;
  const raw = base * (1 + up) * (1 - cut);
  const damage = Math.max(1, raw);
  applyDamage(source, target, damage);
}

// 他のダメージタイプが増えた場合に備えて汎用的な damageType を受け取る形にしておく
function applyDamage(_source: Actor, target: Actor, amount: number) {
  const damage = Math.ceil(amount);
  target.hp -= damage;
  pushCombatLog(`${damage}のダメージ！`, _source.side, _source.kind);
}
