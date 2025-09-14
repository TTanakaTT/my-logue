import type { ActionDef } from '$lib/domain/entities/action';
import { calcMaxHP } from '$lib/domain/valueObjects/stats';
import { emitActionLog } from '$lib/domain/services/actionLog';
import { applyDamage } from '$lib/domain/services/damage';
import { ActionId } from './actionIds';

export const actions: ActionDef[] = [
  {
    id: ActionId.Strike,
    name: 'ストライク',
    description: '基本攻撃: 6 + STR',
    log: ({ actor, target }) => (target ? `ストライク ${6 + actor.STR}ダメージ` : 'ストライク'),
    execute: (state, { actor, target }) => {
      const damage = 6 + actor.STR;
      if (target) {
        applyDamage(state, actor, target, damage);
        emitActionLog(state, actor, target, actions.find((a) => a.id === ActionId.Strike)!);
      }
    }
  },
  {
    id: ActionId.Heavy,
    name: 'ヘビーブロー',
    description: '強攻撃: 12 + floor(STR*0.5) (次ターン出現しない)',
    cooldownTurns: 1,
    log: () => '渾身の一撃！',
    execute: (state, { actor, target }) => {
      const add = Math.floor(actor.STR * 0.5);
      const damage = 12 + add;
      if (target) {
        applyDamage(state, actor, target, damage);
        emitActionLog(state, actor, target, actions.find((a) => a.id === ActionId.Heavy)!);
      }
    }
  },
  {
    id: ActionId.Guard,
    name: 'ガード',
    description: 'このターン受ける次のダメージ半減',
    log: () => '防御態勢を取った',
    execute: (state, { actor }) => {
      actor.guard = true;
      emitActionLog(state, actor, undefined, actions.find((a) => a.id === ActionId.Guard)!);
    }
  },
  {
    id: ActionId.Recover,
    name: '回復',
    description: 'HP5回復',
    log: ({ actor }) => `回復 (${actor.hp}/${calcMaxHP(actor)})`,
    execute: (state, { actor }) => {
      const max = calcMaxHP(actor);
      const before = actor.hp;
      const heal = Math.min(5, max - before);
      actor.hp = before + heal;
      emitActionLog(state, actor, undefined, actions.find((a) => a.id === ActionId.Recover)!);
    }
  },
  {
    id: ActionId.Poison,
    name: 'ポイズンダート',
    description: '敵に3ダメ/ターン (3ターン)',
    log: () => '毒を投げた',
    execute: (state, { actor, target }) => {
      if (!target) return;
      const list = target.dots;
      const existing = list.find((d) => d.id === 'poison');
      if (existing) existing.turns = 3;
      else list.push({ id: 'poison', damage: 3, turns: 3 });
      emitActionLog(state, actor, target, actions.find((a) => a.id === ActionId.Poison)!);
    }
  },
  {
    id: ActionId.PowerUp,
    name: 'パワーアップ',
    description: 'STR+1 永続 (派生攻撃上昇)',
    log: ({ actor }) => `筋力上昇 STR:${actor.STR}`,
    execute: (state, { actor }) => {
      actor.STR += 1;
      emitActionLog(state, actor, undefined, actions.find((a) => a.id === ActionId.PowerUp)!);
    }
  }
];
