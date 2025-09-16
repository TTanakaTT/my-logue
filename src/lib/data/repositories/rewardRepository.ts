import rewardCsvRaw from '$lib/data/consts/reward.csv?raw';
import rewardDetailCsvRaw from '$lib/data/consts/reward_detail.csv?raw';
import type { GameState, RewardOption } from '$lib/domain/entities/battleState';
import type { actionName } from '$lib/domain/entities/actionName';
import { calcMaxHP } from '$lib/domain/services/stats';
import { recalcPlayer, pushLog } from '$lib/domain/state/state';
import type { Player } from '$lib/domain/entities/character';

// reward.csv: id(number),kind,name,label
// reward_detail.csv: rewardName,type,target,value,extra
//   type: stat|action|dots

// enemy_{actorKind} 形式を許容し、将来のkind追加にコード変更不要にする
type RawKind = `enemy_${string}`;
interface RewardRow {
  id: number; // 数値連番
  name: string; // 論理名
  kind: RawKind;
  label: string;
}

interface RewardDetailRow {
  rewardName: string;
  type: 'stat' | 'action' | 'dots';
  target: string;
  value: string; // number or encoded
  extra: string; // optional
}

function parse(csvRaw: string): string[][] {
  return csvRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((line) => line.split(',').map((s) => s.trim()));
}

const rewardRows: RewardRow[] = parse(rewardCsvRaw)
  .slice(1)
  .map((cols) => {
    const [idStr, kindRaw, name, label] = cols;
    const id = Number(idStr);
    if (Number.isNaN(id)) throw new Error(`reward.csv invalid numeric id: ${idStr}`);
    if (!kindRaw.startsWith('enemy_')) {
      throw new Error(`Invalid kind in reward.csv (must start with enemy_): ${kindRaw}`);
    }
    return { id, name, kind: kindRaw as RawKind, label };
  });

const detailRows: RewardDetailRow[] = parse(rewardDetailCsvRaw)
  .slice(1)
  .map((cols) => {
    const [rewardName, type, target, value, extra = ''] = cols;
    if (!rewardName) throw new Error('reward_detail.csv: rewardName empty');
    if (!['stat', 'action', 'dots'].includes(type)) {
      throw new Error(`reward_detail.csv invalid type: ${type}`);
    }
    return { rewardName, type: type as RewardDetailRow['type'], target, value, extra };
  });

function applyDetail(s: GameState, d: RewardDetailRow) {
  switch (d.type) {
    case 'stat': {
      const amount = Number(d.value || '0');
      if (d.target === 'hp') {
        const max = calcMaxHP(s.player);
        s.player.hp = Math.min(max, s.player.hp + amount);
        pushLog(s, `HP+${Math.min(amount, max)} (<=最大HP)`, 'system');
      } else {
        type NumericPlayerStat = Exclude<
          keyof Player,
          | 'name'
          | 'side'
          | 'kind'
          | 'hp'
          | 'guard'
          | 'dots'
          | 'buffs'
          | 'actions'
          | 'revealed'
          | 'revealedActions'
          | 'maxActionsPerTurn'
          | 'maxActionChoices'
          | 'score'
        >;
        const numericKeys: Record<string, NumericPlayerStat> = {
          STR: 'STR',
          CON: 'CON',
          POW: 'POW',
          DEX: 'DEX',
          APP: 'APP',
          INT: 'INT'
        };
        const key = numericKeys[d.target];
        if (key) {
          s.player[key] += amount;
          recalcPlayer(s.player);
          pushLog(s, `${key}+${amount}`, 'system');
        }
      }
      break;
    }
    case 'action': {
      // 追加アクション (現在仕様未使用) value=add/ensure
      const mode = d.value || 'add';
      const act = d.target as actionName;
      if (!s.player.actions.includes(act)) {
        s.player.actions.push(act);
        pushLog(s, `新アクション取得: ${act}`, 'system');
      } else if (mode === 'ensure') {
        // 既にある場合は何もしない
      }
      break;
    }
    case 'dots': {
      // value=0 -> 指定dot除去
      if (d.value === '0') {
        const before = s.player.dots.length;
        s.player.dots = s.player.dots.filter((x) => x.id !== d.target);
        if (before !== s.player.dots.length) pushLog(s, `${d.target} 解除`, 'system');
        break;
      }
      const [damageStr, turnsStr] = (d.value || '').split(':');
      const damage = Number(damageStr || '0');
      const turns = Number(turnsStr || '0');
      const existing = s.player.dots.find((x) => x.id === d.target);
      if (existing) {
        existing.turns = Math.max(existing.turns, turns);
      } else {
        s.player.dots.push({ id: d.target, damage, turns });
      }
      pushLog(s, `${d.target} 付与`, 'system');
      break;
    }
  }
}

function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getRewardsForEnemy(state: GameState, enemyKind: string): RewardOption[] {
  const rawKind = `enemy_${enemyKind}` as RawKind;
  const candidates = rewardRows.filter((r) => r.kind === rawKind);

  // アクション報酬のうち既所持のものは除外
  const filtered = candidates.filter((row) => {
    const details = detailRows.filter((d) => d.rewardName === row.name);
    const actionDetail = details.find((d) => d.type === 'action');
    if (actionDetail) {
      const act = actionDetail.target as actionName;
      if (state.player.actions.includes(act)) return false; // 既に所持
    }
    return true;
  });

  const picked = shuffle(filtered.slice())
    .slice(0, 3)
    .sort((a, b) => a.id - b.id);

  return picked.map<RewardOption>((row) => ({
    id: String(row.id),
    label: row.label,
    // UI表示用途: normal/boss 既存型は維持。未知(kind!==normal/boss)はnormal扱い。
    kind: (enemyKind === 'normal' || enemyKind === 'boss'
      ? enemyKind
      : 'normal') as RewardOption['kind'],
    apply: (s) => {
      const details = detailRows.filter((d) => d.rewardName === row.name);
      for (const d of details) applyDetail(s, d);
    }
  }));
}
