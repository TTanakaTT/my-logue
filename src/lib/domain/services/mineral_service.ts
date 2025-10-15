import type { Actor } from '$lib/domain/entities/character';
import { applyMineralBonus, calcMaxHP } from '$lib/domain/services/attribute_service';
import { isPlayer } from '$lib/domain/entities/character';
import { getMineral, listMinerals } from '$lib/data/repositories/mineral_repository';
import { listByRarity } from '$lib/data/repositories/mineral_repository';
import { pushLog } from '$lib/presentation/utils/log_util';
import type { Action } from '$lib/domain/entities/action';
import { m } from '$lib/paraglide/messages';

export function awardMineral(actor: Actor, mineralId: string): boolean {
  const def = getMineral(mineralId);
  if (!def) return false;
  if (!actor.heldMineralIds) actor.heldMineralIds = [];
  if (actor.heldMineralIds.includes(def.id)) {
    pushLog(m.log_mineral_alreadyOwned({ name: def.nameJa }), 'system');
    return false;
  }
  actor.heldMineralIds.push(def.id);
  applyMineralBonus(actor, {
    STR: def.STR,
    CON: def.CON,
    POW: def.POW,
    DEX: def.DEX,
    APP: def.APP,
    INT: def.INT
  });
  // 行動系の補正
  if (typeof def.maxActionsPerTurn === 'number') {
    actor.characterAttributes.maxActionsPerTurn += def.maxActionsPerTurn;
  }
  if (typeof def.maxActionChoices === 'number' && isPlayer(actor)) {
    actor.maxActionChoices = actor.maxActionChoices + def.maxActionChoices;
  }
  // アクション付与
  if (Array.isArray(def.grantedActions) && def.grantedActions.length > 0) {
    const newActions: Action[] = [];
    for (const a of def.grantedActions) {
      if (!actor.actions.includes(a)) newActions.push(a);
    }
    if (newActions.length > 0) {
      actor.actions = [...actor.actions, ...newActions];
      pushLog(m.log_learned_new_actions({ actions: newActions.join(', ') }), 'system');
    }
  }
  // CON上昇などで最大HPが変わる場合に備え再計算
  const newMax = calcMaxHP(actor);
  if (actor.hp > newMax) actor.hp = newMax;
  pushLog(m.log_got_mineral({ name: def.nameJa, rarity: String(def.rarity) }), 'system');
  return true;
}

export function pickRandomMineralId(excludeIds: string[] = []): string | undefined {
  const pool = listMinerals().filter((m) => !excludeIds.includes(m.id));
  if (pool.length === 0) return undefined;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  return picked.id;
}

export function awardRandomMineral(actor: Actor): string | undefined {
  const id = pickRandomMineralId(actor.heldMineralIds || []);
  if (!id) return undefined;
  const ok = awardMineral(actor, id);
  return ok ? id : undefined;
}

export function awardRandomMineralByRarity(
  actor: Actor,
  rarity: 1 | 2 | 3 | 4 | 5
): string | undefined {
  const pool = listByRarity(rarity).filter((m) => !(actor.heldMineralIds || []).includes(m.id));
  if (pool.length === 0) return undefined;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  const ok = awardMineral(actor, picked.id);
  return ok ? picked.id : undefined;
}
