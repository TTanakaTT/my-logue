import type { ActionDef, GameState, Actor } from './types';
import { pushLog, pushCombatLog } from './state';
import { calcAttack, calcMaxHP } from './stats';

function dealDamage(state: GameState, source: Actor, target?: Actor, dmg?: number) {
  if (!target || dmg === undefined) return;
  target.hp -= dmg;
  const src = source === state.player ? 'プレイヤー' : '敵';
  const tgt = target === state.player ? 'プレイヤー' : '敵';
  const tag: 'player' | 'enemy' | 'boss' =
    source === state.player
      ? 'player'
      : state.enemy && state.enemy.kind === 'boss'
        ? 'boss'
        : 'enemy';
  pushCombatLog(state, `${src}の攻撃 -> ${tgt}に${dmg}ダメージ (残り${target.hp})`, tag);
}

export const actions: ActionDef[] = [
  {
    id: 'strike',
    name: 'ストライク',
    description: '基本攻撃: 6 + STR由来攻撃',
    execute: (state, { actor, target }) => {
      const dmg = 6 + calcAttack(actor);
      dealDamage(state, actor, target, dmg);
    }
  },
  {
    id: 'heavy',
    name: 'ヘビーブロー',
    description: '強攻撃: 12 + 攻撃*0.5 (次ターン出現しない)',
    cooldownTurns: 1,
    execute: (state, { actor, target }) => {
      const atk = calcAttack(actor);
      dealDamage(state, actor, target, 12 + Math.floor(atk * 0.5));
    }
  },
  {
    id: 'guard',
    name: 'ガード',
    description: 'このターン受ける次のダメージ半減',
    execute: (state, { actor }) => {
      actor.guard = true;
      pushCombatLog(
        state,
        '防御態勢! 次の被ダメ半減',
        actor === state.player ? 'player' : state.enemy?.kind === 'boss' ? 'boss' : 'enemy'
      );
    }
  },
  {
    id: 'recover',
    name: '回復',
    description: 'HP5回復',
    execute: (state, { actor }) => {
      const before = actor.hp;
      const max = calcMaxHP(actor);
      actor.hp = Math.min(max, actor.hp + 5);
      pushCombatLog(
        state,
        `HPを${actor.hp - before}回復 (${actor.hp}/${max})`,
        actor === state.player ? 'player' : state.enemy?.kind === 'boss' ? 'boss' : 'enemy'
      );
    }
  },
  {
    id: 'poison',
    name: 'ポイズンダート',
    description: '敵に3ダメ/ターン (3ターン)',
    execute: (state, { actor, target }) => {
      if (!target) return;
      // 毒は「対象」に付与され、その対象自身のターン終了処理でダメージを受ける
      const list = target.dots;
      const existing = list.find((d) => d.id === 'poison');
      if (existing) existing.turns = 3;
      else list.push({ id: 'poison', damage: 3, turns: 3 });
      pushCombatLog(
        state,
        '毒を付与した (3ターン)',
        actor === state.player ? 'player' : state.enemy?.kind === 'boss' ? 'boss' : 'enemy'
      );
    }
  },
  {
    id: 'powerup',
    name: 'パワーアップ',
    description: 'STR+1 永続 (派生攻撃上昇)',
    execute: (state, { actor }) => {
      actor.STR += 1;
      const atk = calcAttack(actor);
      pushCombatLog(
        state,
        `STRが${actor.STR}になった (攻撃:${atk})`,
        actor === state.player ? 'player' : state.enemy?.kind === 'boss' ? 'boss' : 'enemy'
      );
    }
  }
];

export function getAction(id: string) {
  return actions.find((a) => a.id === id);
}
