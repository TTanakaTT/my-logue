import type { GameState, RewardOption } from '$lib/domain/entities/battleState';
import { calcMaxHP } from '$lib/domain/services/stats';

// 敵撃破時/ボス撃破時の報酬定義集約ファイル。
// actions.ts と同様にビルダー関数で配列を返す形にし、
// state 側では選択ロジックのみを扱う。
// ここでは log 追加処理を最小限ローカル実装 (pushLog の重複) し、
// 循環依存を避けるため state.ts からは import しない。

function pushSystemLog(state: GameState, message: string) {
  state.log.unshift({ message, kind: 'system' });
  if (state.log.length > 20) state.log.pop();
}

// 通常戦闘報酬
export function buildNormalRewards(): RewardOption[] {
  return [
    {
      id: 'hp5',
      label: 'CON+1 (最大HP再計算&割合維持)',
      kind: 'normal',
      apply: (s: GameState) => {
        // 既存実装踏襲 (CON 加算後に prevMax を計算している点も一旦そのまま)
        s.player.CON += 1;
        const prevMax = calcMaxHP(s.player);
        const ratio = prevMax > 0 ? s.player.hp / prevMax : 1;
        const newMax = calcMaxHP(s.player);
        s.player.hp = Math.min(newMax, Math.max(1, Math.round(newMax * ratio)));
        if (s.player.hp > newMax) s.player.hp = newMax;
        pushSystemLog(s, 'CON+1 (最大HP上昇)');
      }
    },
    {
      id: 'atk1',
      label: 'STR+1',
      kind: 'normal',
      apply: (s: GameState) => {
        s.player.STR += 1;
        // HP上限超過調整
        const max = calcMaxHP(s.player);
        if (s.player.hp > max) s.player.hp = max;
        pushSystemLog(s, 'STR+1');
      }
    },
    {
      id: 'powerup',
      label: '新アクション: パワーアップ (なければ)',
      kind: 'normal',
      apply: (s: GameState) => {
        if (!s.player.actions.includes('PowerUp')) {
          s.player.actions.push('PowerUp');
          pushSystemLog(s, '新アクション取得: パワーアップ');
        } else {
          s.player.STR += 1;
          const max = calcMaxHP(s.player);
          if (s.player.hp > max) s.player.hp = max;
          pushSystemLog(s, '代替: STR+1');
        }
      }
    }
  ];
}

// ボス報酬 (finalBoss=true の場合は別テーブル)
export function buildBossRewards(finalBoss: boolean): RewardOption[] {
  if (finalBoss) {
    return [
      {
        id: 'final-score',
        label: '最終勝利: 追加スコア+5',
        kind: 'boss',
        apply: (s: GameState) => {
          s.player.score += 5;
          pushSystemLog(s, '最終ボーナス +5スコア');
        }
      }
    ];
  }
  return [
    {
      id: 'boss-maxhp',
      label: 'CON+2 (最大HP再計算&割合維持)',
      kind: 'boss',
      apply: (s: GameState) => {
        s.player.CON += 2;
        const prevMax = calcMaxHP(s.player);
        const ratio = prevMax > 0 ? s.player.hp / prevMax : 1;
        const newMax = calcMaxHP(s.player);
        s.player.hp = Math.min(newMax, Math.max(1, Math.round(newMax * ratio)));
        if (s.player.hp > newMax) s.player.hp = newMax;
        pushSystemLog(s, 'CON+2');
      }
    },
    {
      id: 'boss-atk2',
      label: 'STR+2',
      kind: 'boss',
      apply: (s: GameState) => {
        s.player.STR += 2;
        const max = calcMaxHP(s.player);
        if (s.player.hp > max) s.player.hp = max;
        pushSystemLog(s, 'STR+2');
      }
    },
    {
      id: 'boss-cleanse',
      label: 'HP全回復 & 状態異常解除',
      kind: 'boss',
      apply: (s: GameState) => {
        s.player.hp = calcMaxHP(s.player);
        s.player.dots = [];
        pushSystemLog(s, '全回復');
      }
    }
  ];
}
