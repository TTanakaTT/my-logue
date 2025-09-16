import type { ActionDef } from '$lib/domain/entities/action';
import { calcMaxHP } from '$lib/domain/services/stats';
import { applyDamage } from '$lib/domain/services/damage';

export const action = {
  Strike: {
    name: 'ストライク',
    description: 'STRで攻撃',
    log: ({ actor, target }) => {
      let log = `${actor.STR}の力で攻撃！`;
      if (target) {
        if (target.guard) log += `${target.name}は守りの体制を取って、ダメージを半減させた！`;
        log += `${target.name}に${applyDamage(actor, target, actor.STR)}のダメージ！`;
      }
      return log;
    },
    execute: ({ actor, target }) => {
      if (target) {
        applyDamage(actor, target, actor.STR);
      }
    }
  },
  Heavy: {
    name: 'ヘビーブロー',
    description: '強攻撃: 12 + floor(STR*0.5) (次ターン出現しない)',
    cooldownTurns: 1,
    log: () => '渾身の一撃！',
    execute: ({ actor, target }) => {
      const add = Math.floor(actor.STR * 0.5);
      const damage = 12 + add;
      if (target) {
        applyDamage(actor, target, damage);
      }
    }
  },
  Guard: {
    name: 'ガード',
    description: 'このターン受ける次のダメージ半減',
    log: () => '防御態勢を取った',
    execute: ({ actor }) => {
      actor.guard = true;
    }
  },
  Recover: {
    name: '回復',
    description: 'HP5回復',
    log: ({ actor }) => `回復 (${actor.hp}/${calcMaxHP(actor)})`,
    execute: ({ actor }) => {
      const max = calcMaxHP(actor);
      const before = actor.hp;
      const heal = Math.min(5, max - before);
      actor.hp = before + heal;
    }
  },
  Poison: {
    name: 'ポイズンダート',
    description: '敵に3ダメ/ターン (3ターン)',
    log: () => '毒を投げた',
    execute: ({ target }) => {
      if (!target) return;
      const list = target.dots;
      const existing = list.find((d) => d.id === 'poison');
      if (existing) existing.turns = 3;
      else list.push({ id: 'poison', damage: 3, turns: 3 });
    }
  },
  PowerUp: {
    name: 'パワーアップ',
    description: 'STR+1 永続 (派生攻撃上昇)',
    log: ({ actor }) => `筋力上昇 STR:${actor.STR}`,
    execute: ({ actor }) => {
      actor.STR += 1;
    }
  }
} satisfies Record<string, ActionDef>;
