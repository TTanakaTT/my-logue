import { pushCombatLog } from '$lib/presentation/utils/log_util';
import { showHeal } from '$lib/presentation/utils/effect_bus';
import {
  type Actor,
  CHARACTER_ATTRIBUTES,
  type CharacterAttribute
} from '$lib/domain/entities/character';

export function calcMaxHP(actor: Actor): number {
  return 10 + actor.CON * 5;
}

export function applyMineralBonus(
  actor: Actor,
  bonus: Partial<Record<CharacterAttribute, number>>
) {
  // ボーナスは公開フィールドに直接加算し、baseAttributesは据え置き
  (CHARACTER_ATTRIBUTES as CharacterAttribute[]).forEach((k) => {
    const add = bonus[k] || 0;
    if (add) {
      actor[k] = (actor[k] ?? 0) + add;
    }
  });
}

export function heal(_source: Actor, amount: number): number {
  const max = calcMaxHP(_source);
  const before = _source.hp;
  _source.hp = Math.min(max, _source.hp + amount);
  pushCombatLog(`${amount}回復。`, _source.side, _source.kind);
  const healed = _source.hp - before;
  if (healed > 0) showHeal(_source, healed);
  return healed;
}
