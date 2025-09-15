import rewardCsvRaw from '$lib/data/consts/reward.csv?raw';
import rewardDetailCsvRaw from '$lib/data/consts/reward_detail.csv?raw';
import type { GameState, RewardOption } from '$lib/domain/entities/battleState';
import type { actionName } from '$lib/domain/entities/actionName';
import { calcMaxHP } from '$lib/domain/services/stats';
import { recalcPlayer, pushLog } from '$lib/domain/state/state';

// reward.csv: id,kind,label
// reward_detail.csv: rewardId,type,target,value,extra
//   type: stat|action|dots

interface RewardRow {
  id: string;
  kind: 'normal' | 'boss';
  label: string;
}

interface RewardDetailRow {
  rewardId: string;
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
    const [id, kindRaw, label] = cols;
    if (kindRaw !== 'normal' && kindRaw !== 'boss') {
      throw new Error(`Invalid kind in reward.csv: ${kindRaw}`);
    }
    return { id, kind: kindRaw as 'normal' | 'boss', label };
  });

const detailRows: RewardDetailRow[] = parse(rewardDetailCsvRaw)
  .slice(1)
  .map((cols) => {
    const [rewardId, type, target, value, extra = ''] = cols;
    if (!rewardId) throw new Error('reward_detail.csv: rewardId empty');
    if (!['stat', 'action', 'dots'].includes(type)) {
      throw new Error(`reward_detail.csv invalid type: ${type}`);
    }
    return { rewardId, type: type as RewardDetailRow['type'], target, value, extra };
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
        if (d.target in s.player) {
          // @ts-expect-error indexing
          s.player[d.target] += amount;
          recalcPlayer(s.player);
          pushLog(s, `${d.target}+${amount}`, 'system');
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

export function getRewards(kind: 'normal' | 'boss'): RewardOption[] {
  return rewardRows
    .filter((r) => r.kind === kind)
    .map<RewardOption>((row) => ({
      id: row.id,
      label: row.label,
      kind: row.kind,
      apply: (s) => {
        const details = detailRows.filter((d) => d.rewardId === row.id);
        for (const d of details) {
          applyDetail(s, d);
        }
      }
    }));
}
