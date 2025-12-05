import rewardCsvRaw from '$lib/data/consts/rewards.csv?raw';
import rewardDetailCsvRaw from '$lib/data/consts/reward_detail.csv?raw';
import type { GameState, RewardOption } from '$lib/domain/entities/battle_state';
import type { Action } from '$lib/domain/entities/action';
import { calcMaxHP } from '$lib/domain/services/attribute_service';
import { pushLog } from '$lib/presentation/utils/log_util';
import { shuffle } from '$lib/utils/array_util';
import {
  awardMineral,
  awardRandomMineral,
  awardRandomMineralByRarity
} from '$lib/domain/services/mineral_service';
import { parseCsv } from '$lib/data/repositories/utils/csv_util';
import { getMineral, listByRarity, listMinerals } from '$lib/data/repositories/mineral_repository';
import type { Mineral } from '$lib/domain/entities/mineral';
import { action as ACTION_DEFS } from '$lib/data/consts/actions';
import { m } from '$lib/paraglide/messages';

// rewards.csv: id(number),kind,name,label,floorMin?,floorMax?
// reward_detail.csv: rewardName,type,target,value,extra
//   type: stat|action|dots

// enemy_{actorKind} / node_reward を許容
type RawKind = `enemy_${string}` | 'node_reward';
interface RewardRow {
  id: number;
  name: string;
  kind: RawKind;
  label: string;
  floorMin?: number;
  floorMax?: number;
}

interface RewardDetailRow {
  rewardName: string;
  type: 'stat' | 'action' | 'dots' | 'mineral';
  target: string;
  value: string; // number or encoded
  extra: string; // optional
}

const rewardRows: RewardRow[] = parseCsv(rewardCsvRaw)
  .slice(1)
  .map((cols) => {
    const [idStr, kindRaw, name, label, floorMinStr, floorMaxStr] = cols;
    const id = Number(idStr);
    if (Number.isNaN(id)) throw new Error(`rewards.csv invalid numeric id: ${idStr}`);
    if (!kindRaw.startsWith('enemy_') && kindRaw !== 'node_reward') {
      throw new Error(
        `Invalid kind in rewards.csv (must start with enemy_ or be node_reward): ${kindRaw}`
      );
    }
    const floorMin =
      floorMinStr !== undefined && floorMinStr !== '' ? Number(floorMinStr) : undefined;
    const floorMax =
      floorMaxStr !== undefined && floorMaxStr !== '' ? Number(floorMaxStr) : undefined;
    return { id, name, kind: kindRaw as RawKind, label, floorMin, floorMax };
  });

const detailRows: RewardDetailRow[] = parseCsv(rewardDetailCsvRaw)
  .slice(1)
  .map((cols) => {
    const [rewardName, type, target, value, extra = ''] = cols;
    if (!rewardName) throw new Error('reward_detail.csv: rewardName empty');
    if (!['stat', 'action', 'dots', 'mineral'].includes(type)) {
      throw new Error(`reward_detail.csv invalid type: ${type}`);
    }
    return { rewardName, type: type as RewardDetailRow['type'], target, value, extra };
  });

function applyDetail(s: GameState, d: RewardDetailRow) {
  switch (d.type) {
    case 'mineral': {
      // d.target: 'rarity' | mineralId
      if (d.target === 'rarity') {
        const rarity = Number(d.value) as 1 | 2 | 3 | 4 | 5;
        const id = awardRandomMineralByRarity(s.player, rarity);
        if (id) pushLog(`${id}を獲得`, 'system');
      } else if (d.target === 'random') {
        const id = awardRandomMineral(s.player);
        if (id) pushLog(`${id}を獲得`, 'system');
      } else {
        const ok = awardMineral(s.player, d.target);
        if (ok) pushLog(`${d.target}を獲得`, 'system');
      }

      s.player = { ...s.player };
      break;
    }
    case 'stat': {
      const amount = Number(d.value || '0');
      if (d.target === 'hp') {
        const max = calcMaxHP(s.player);
        s.player.hp = Math.min(max, s.player.hp + amount);
        pushLog(`HP+${Math.min(amount, max)} (<=最大HP)`, 'system');
      } else {
        if (d.target === 'maxActionsPerTurn') {
          s.player.characterAttributes.maxActionsPerTurn += amount;
          pushLog(`行動回数+${amount}`, 'system');
        }
      }
      break;
    }
    case 'action': {
      const act = d.target as Action;
      if (!s.player.actions.includes(act)) {
        s.player.actions.push(act);
        pushLog(`新アクション取得: ${act}`, 'system');
      }
      break;
    }
  }
}

function formatMineralEffects(mineral: Mineral): string {
  const parts: string[] = [];
  const mapKeyToLabel: Record<string, string> = {
    STR: m.attr_STR(),
    CON: m.attr_CON(),
    POW: m.attr_POW(),
    DEX: m.attr_DEX(),
    APP: m.attr_APP(),
    INT: m.attr_INT(),
    maxActionsPerTurn: m.attr_actionsPerTurn(),
    maxActionChoices: m.attr_actionChoices()
  };
  (['STR', 'CON', 'POW', 'DEX', 'APP', 'INT'] as const).forEach((k) => {
    if (mineral[k]) parts.push(`${mapKeyToLabel[k]}+${mineral[k]}`);
  });
  if (mineral.maxActionsPerTurn)
    parts.push(`${mapKeyToLabel.maxActionsPerTurn}+${mineral.maxActionsPerTurn}`);
  if (mineral.maxActionChoices)
    parts.push(`${mapKeyToLabel.maxActionChoices}+${mineral.maxActionChoices}`);
  if (mineral.grantedActions && mineral.grantedActions.length > 0) {
    const names = mineral.grantedActions
      .map((id) => ACTION_DEFS[id]?.name || id)
      .filter(Boolean)
      .join(' / ');
    parts.push(`${m.ui_effect_actions()}: ${names}`);
  }
  return parts.join('\n');
}

function pickMineralForDetail(state: GameState, d: RewardDetailRow): Mineral | undefined {
  if (d.type !== 'mineral') return undefined;
  const held = state.player.heldMineralIds || [];
  if (d.target === 'rarity') {
    const rarity = Number(d.value) as 1 | 2 | 3 | 4 | 5;
    const pool = listByRarity(rarity).filter((m) => !held.includes(m.id));
    const picked = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : undefined;
    return picked;
  }
  if (d.target === 'random') {
    const pool = listMinerals().filter((m) => !held.includes(m.id));
    const picked = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : undefined;
    return picked;
  }
  const byId = getMineral(d.target);
  return byId;
}

/**
 * Generate reward candidates for a specific enemy kind.
 * 1. Select rows from rewards.csv where kind matches `enemy_*` and the floor is within floorMin/floorMax.
 * 2. Exclude action-type rewards the player already owns.
 * 3. For boss fights, force-include the 'act_slot_up1' reward (1F-only) and fill the remaining slots randomly.
 * 4. Return up to 3 entries (including any forced entries).
 */
export function getRewardsForEnemy(state: GameState, enemyKind: string): RewardOption[] {
  const rawKind = `enemy_${enemyKind}` as RawKind;
  const floor = state.floorIndex;
  const candidates = rewardRows.filter((r) => {
    if (r.kind !== rawKind) return false;
    if (r.floorMin !== undefined && floor < r.floorMin) return false;
    if (r.floorMax !== undefined && floor > r.floorMax) return false;
    return true;
  });

  const filtered = candidates.filter((row) => {
    const details = detailRows.filter((d) => d.rewardName === row.name);
    const actionDetail = details.find((d) => d.type === 'action');
    if (actionDetail) {
      const act = actionDetail.target as Action;
      if (state.player.actions.includes(act)) return false; // 既に所持
    }
    return true;
  });

  const limited: RewardRow[] = [];
  if (enemyKind === 'boss') {
    const actSlot = filtered.find((r) => r.name === 'act_slot_up1');
    if (actSlot) limited.push(actSlot);
  }

  const restPool = filtered.filter((r) => !limited.includes(r));
  const pickedRandom = shuffle(restPool.slice()).slice(0, Math.max(0, 3 - limited.length));
  const picked = [...limited, ...pickedRandom].sort((a, b) => a.id - b.id);

  return picked.map<RewardOption>((row) => {
    const details = detailRows.filter((d) => d.rewardName === row.name);
    const mineralDetail = details.find((d) => d.type === 'mineral');
    if (mineralDetail) {
      const pickedMineral = pickMineralForDetail(state, mineralDetail);
      if (pickedMineral) {
        const effects = formatMineralEffects(pickedMineral);
        const label = `${pickedMineral.name} (★${pickedMineral.rarity})\n${effects}`;
        return {
          id: String(row.id),
          label,
          apply: (s) => {
            // Award the pre-selected mineral to the player
            awardMineral(s.player, pickedMineral.id);
          }
        } satisfies RewardOption;
      }
    }
    return {
      id: String(row.id),
      label: row.label,
      apply: (s) => {
        const ds = detailRows.filter((d) => d.rewardName === row.name);
        for (const d of ds) applyDetail(s, d);
      }
    } satisfies RewardOption;
  });
}

/**
 * Generate reward candidates for a reward node.
 * Returns up to 3 entries from rewards.csv
 * where kind === 'node_reward'
 * and the floor is within the specified floorMin/floorMax range.
 */
export function getRewardsForRewardNode(state: GameState): RewardOption[] {
  const floor = state.floorIndex; // 0-index
  const candidates = rewardRows.filter((r) => {
    if (r.kind !== 'node_reward') return false;
    if (r.floorMin !== undefined && floor < r.floorMin) return false;
    if (r.floorMax !== undefined && floor > r.floorMax) return false;
    return true;
  });

  const MAX_REWARDS = 3;
  const picked = shuffle(candidates.slice())
    .slice(0, MAX_REWARDS)
    .sort((a, b) => a.id - b.id);
  return picked.map<RewardOption>((row) => {
    const details = detailRows.filter((d) => d.rewardName === row.name);
    const mineralDetail = details.find((d) => d.type === 'mineral');
    if (mineralDetail) {
      const pickedMineral = pickMineralForDetail(state, mineralDetail);
      if (pickedMineral) {
        const effects = formatMineralEffects(pickedMineral);
        const label = `${pickedMineral.name} (★${pickedMineral.rarity})\n${effects}`;
        return {
          id: String(row.id),
          label,
          apply: (s) => {
            awardMineral(s.player, pickedMineral.id);
          }
        } satisfies RewardOption;
      }
    }
    return {
      id: String(row.id),
      label: row.label,
      apply: (s) => {
        const ds = detailRows.filter((d) => d.rewardName === row.name);
        for (const d of ds) applyDetail(s, d);
      }
    } satisfies RewardOption;
  });
}
