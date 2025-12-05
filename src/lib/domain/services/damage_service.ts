import { pushCombatLog } from '$lib/presentation/utils/log_util';
import { showDamage } from '$lib/presentation/utils/effect_bus';
import type { Actor } from '$lib/domain/entities/character';
import type { DamageKind } from '$lib/domain/entities/status';
import { onIncomingDamage } from '$lib/data/consts/statuses';

export function applyPhysicalDamage(source: Actor, target: Actor, amount: number) {
  const up = source.physDamageUpRate || 0;
  const def = target.physDefenseUpRate || 0;
  const incoming = amount * (1 + up);
  const raw = incoming / (1 + def);
  const damage = Math.max(1, raw);
  applyDamage(source, target, damage, incoming, 'physical');
}
export function applyPsychicDamage(source: Actor, target: Actor, amount: number) {
  const up = source.psyDamageUpRate || 0;
  const def = target.psyDefenseUpRate || 0;
  const incoming = amount * (1 + up);
  const raw = incoming / (1 + def);
  const damage = Math.max(1, raw);
  applyDamage(source, target, damage, incoming, 'psychic');
}

function applyDamage(
  source: Actor,
  target: Actor,
  amount: number,
  rawAmount: number,
  kind: DamageKind
) {
  const damage = Math.ceil(amount);
  onIncomingDamage(target, damage, rawAmount, kind, source);
  if (damage <= 0) return;
  target.hp -= damage;
  pushCombatLog(`${damage}のダメージ！`, source.side, source.kind);
  showDamage(target, damage);
}
