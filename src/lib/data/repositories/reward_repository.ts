import rewardCsvRaw from '$lib/data/consts/rewards.csv?raw';
import rewardDetailCsvRaw from '$lib/data/consts/reward_detail.csv?raw';
import type { GameState, RewardOption } from '$lib/domain/entities/battle_state';
import type { Action } from '$lib/domain/entities/action';
import { calcMaxHP } from '$lib/domain/services/attribute_service';
import { recalcPlayer } from '$lib/domain/services/state_service';
import { pushLog } from '$lib/presentation/utils/logUtil';
import type { Actor } from '$lib/domain/entities/character';
import { addStatus, findStatus, removeStatus } from '$lib/data/consts/statuses';

// rewards.csv: id(number),kind,name,label,floorMin?,floorMax?
// reward_detail.csv: rewardName,type,target,value,extra
//   type: stat|action|dots

// enemy_{actorKind} 形式を許容し、将来のkind追加にコード変更不要にする
type RawKind = `enemy_${string}`;
interface RewardRow {
  id: number; // 数値連番
  name: string; // 論理名
  kind: RawKind;
  label: string;
  floorMin?: number; // 出現下限
  floorMax?: number; // 出現上限
}

interface RewardDetailRow {
  rewardName: string;
  type: 'stat' | 'action' | 'dots';
  target: string;
  value: string; // number or encoded
  extra: string; // optional
}

/**
 * 汎用 CSV パーサ (極小仕様)。
 * - # から始まる行はコメントとして除外
 * - 空行は除外
 * - 先頭/末尾の空白はトリム
 */
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
    const [idStr, kindRaw, name, label, floorMinStr, floorMaxStr] = cols;
    const id = Number(idStr);
    if (Number.isNaN(id)) throw new Error(`rewards.csv invalid numeric id: ${idStr}`);
    if (!kindRaw.startsWith('enemy_')) {
      throw new Error(`Invalid kind in rewards.csv (must start with enemy_): ${kindRaw}`);
    }
    const floorMin =
      floorMinStr !== undefined && floorMinStr !== '' ? Number(floorMinStr) : undefined;
    const floorMax =
      floorMaxStr !== undefined && floorMaxStr !== '' ? Number(floorMaxStr) : undefined;
    return { id, name, kind: kindRaw as RawKind, label, floorMin, floorMax };
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
        pushLog(`HP+${Math.min(amount, max)} (<=最大HP)`, 'system');
      } else {
        type NumericPlayerStat = Exclude<
          keyof Actor,
          'id' | 'name' | 'actions' | 'maxActionsPerTurn' | 'kind' | 'side' | 'hp' | 'statuses'
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
          pushLog(`${key}+${amount}`, 'system');
        } else if (d.target === 'maxActionsPerTurn') {
          s.player.maxActionsPerTurn += amount;
          pushLog(`行動回数+${amount}`, 'system');
        }
      }
      break;
    }
    case 'action': {
      // 追加アクション (現在仕様未使用) value=add/ensure
      const mode = d.value || 'add';
      const act = d.target as Action;
      if (!s.player.actions.includes(act)) {
        s.player.actions.push(act);
        pushLog(`新アクション取得: ${act}`, 'system');
      } else if (mode === 'ensure') {
        // 既にある場合は何もしない
      }
      break;
    }
    case 'dots': {
      // 現在 poison のみ想定。value=0 で解除
      if (d.target !== 'poison') {
        pushLog(`未知の継続効果: ${d.target} (未対応)`, 'system');
        break;
      }
      if (d.value === '0') {
        const ex = findStatus(s.player, 'Poison');
        if (ex) {
          removeStatus(s.player, 'Poison');
          pushLog('poison 解除', 'system');
        }
        break;
      }
      // value のダメージ/ターン数は現状固定実装のため無視 (将来 poison 強化用に利用可)
      addStatus(s.player, 'Poison');
      pushLog('poison 付与', 'system');
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

/**
 * 指定の敵種別に対する報酬候補を生成する。
 * 1. rewards.csv から kind (= enemy_*) に一致し、floor 範囲 (floorMin/floorMax) を満たす行を抽出
 * 2. action 報酬で既に所持しているものを除外
 * 3. ボス戦で 1F 限定の行動回数+1 報酬 (act_slot_up1) を強制的に含め、残りをランダムで補完
 * 4. 最大3件 (限定含む) を返す
 */
export function getRewardsForEnemy(state: GameState, enemyKind: string): RewardOption[] {
  const rawKind = `enemy_${enemyKind}` as RawKind;
  const floor = state.floorIndex; // 0-index
  const candidates = rewardRows.filter((r) => {
    if (r.kind !== rawKind) return false;
    if (r.floorMin !== undefined && floor < r.floorMin) return false;
    if (r.floorMax !== undefined && floor > r.floorMax) return false;
    return true;
  });

  // アクション報酬のうち既所持のものは除外
  const filtered = candidates.filter((row) => {
    const details = detailRows.filter((d) => d.rewardName === row.name);
    const actionDetail = details.find((d) => d.type === 'action');
    if (actionDetail) {
      const act = actionDetail.target as Action;
      if (state.player.actions.includes(act)) return false; // 既に所持
    }
    return true;
  });

  // ボス戦かつ限定報酬(行動回数+1) が候補内にある場合は必ず含める
  const limited: RewardRow[] = [];
  if (enemyKind === 'boss') {
    const actSlot = filtered.find((r) => r.name === 'act_slot_up1');
    if (actSlot) limited.push(actSlot);
  }

  const restPool = filtered.filter((r) => !limited.includes(r));
  const pickedRandom = shuffle(restPool.slice()).slice(0, Math.max(0, 3 - limited.length));
  const picked = [...limited, ...pickedRandom].sort((a, b) => a.id - b.id);

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
