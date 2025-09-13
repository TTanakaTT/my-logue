import type { ActionDef, GameState } from './types';
import { pushLog } from './state';

function dealDamage(state: GameState, dmg: number) {
  const enemy = state.enemy;
  if (!enemy) return;
  enemy.hp -= dmg;
  pushLog(state, `敵に${dmg}ダメージ (残り${enemy.hp})`, 'combat');
  if (enemy.hp <= 0) {
    pushLog(state, '敵を倒した!', 'combat');
    state.player.score += 1;
  }
}

export const actions: ActionDef[] = [
  {
    id: 'strike',
    name: 'ストライク',
    description: '基本攻撃: 6+攻撃力',
    execute: (state) => {
      dealDamage(state, 6 + state.player.attack);
    }
  },
  {
    id: 'heavy',
    name: 'ヘビーブロー',
    description: '強攻撃: 12 (次ターン出現しない)',
    cooldownTurns: 1,
    execute: (state) => {
      dealDamage(state, 12 + Math.floor(state.player.attack * 0.5));
    }
  },
  {
    id: 'guard',
    name: 'ガード',
    description: 'このターン受ける次のダメージ半減',
    execute: (state) => {
      state.player.guard = true;
      pushLog(state, '防御態勢! 次の被ダメ半減', 'combat');
    }
  },
  {
    id: 'recover',
    name: '回復',
    description: 'HP5回復',
    execute: (state) => {
      const p = state.player;
      const before = p.hp;
      p.hp = Math.min(p.maxHP, p.hp + 5);
      pushLog(state, `HPを${p.hp - before}回復 (${p.hp}/${p.maxHP})`, 'combat');
    }
  },
  {
    id: 'poison',
    name: 'ポイズンダート',
    description: '敵に3ダメ/ターン (3ターン)',
    execute: (state) => {
      const enemy = state.enemy;
      if (!enemy) return;
      const existing = state.player.dots.find((d) => d.id === 'poison');
      if (existing) {
        existing.turns = 3; // refresh
      } else {
        state.player.dots.push({ id: 'poison', damage: 3, turns: 3 });
      }
      pushLog(state, '毒を付与した', 'combat');
    }
  },
  {
    id: 'powerup',
    name: 'パワーアップ',
    description: '攻撃力+1 永続 (成長報酬)',
    execute: (state) => {
      state.player.attack += 1;
      pushLog(state, `攻撃力が${state.player.attack}になった`, 'combat');
    }
  }
];

export function getAction(id: string) {
  return actions.find((a) => a.id === id);
}
