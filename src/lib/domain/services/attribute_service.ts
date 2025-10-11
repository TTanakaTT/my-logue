import { pushCombatLog } from '$lib/presentation/utils/log_util';
import { showHeal } from '$lib/presentation/utils/effect_bus';
import {
  type Actor,
  CHARACTER_ATTRIBUTES,
  type CharacterAttributeKey
} from '$lib/domain/entities/character';

export function calcMaxHP(actor: Actor): number {
  return 10 + actor.characterAttributes.CON * 5;
}

export function applyMineralBonus(
  actor: Actor,
  bonus: Partial<Record<CharacterAttributeKey, number>>
) {
  // ボーナスは公開フィールドに直接加算し、baseAttributesは据え置き
  (CHARACTER_ATTRIBUTES as readonly CharacterAttributeKey[]).forEach((k) => {
    const add = bonus[k] || 0;
    if (add) {
      actor.characterAttributes[k] = (actor.characterAttributes[k] ?? 0) + add;
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
