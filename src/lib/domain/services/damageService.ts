import { pushCombatLog } from '$lib/presentation/utils/logUtil';
import type { Actor } from '../entities/character';
import { physicalDamageMultiplier } from '$lib/data/consts/statuses';

export function applyPhysicalDamage(source: Actor, target: Actor, amount: number) {
  // 攻撃側アップ率
  const up = source.physDamageUpRate || 0;
  // 防御側カット率 (statuses で計算済)
  const cut = target.physDamageCutRate || 0;
  const mult = physicalDamageMultiplier(target); // 従来 guard 互換 (積算)
  const raw = amount * (1 + up) * mult * (1 - cut);
  const damage = Math.max(1, Math.ceil(raw));
  applyDamage(source, target, damage);
}
export function applyPsychicDamage(source: Actor, target: Actor, amount: number) {
  const base = Math.max(1, amount - Math.ceil(target.POW * 0.5));
  const up = source.psyDamageUpRate || 0;
  const cut = target.psyDamageCutRate || 0;
  const raw = base * (1 + up) * (1 - cut);
  const damage = Math.max(1, Math.ceil(raw));
  applyDamage(source, target, damage);
}

// 他のダメージタイプが増えた場合に備えて汎用的な damageType を受け取る形にしておく
function applyDamage(_source: Actor, target: Actor, amount: number) {
  target.hp -= amount;
  pushCombatLog(`${amount}のダメージ！`, _source.side, _source.kind);
}
