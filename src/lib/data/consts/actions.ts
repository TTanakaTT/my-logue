import type { ActionDef } from '$lib/domain/entities/action';
import { calcMaxHP } from '$lib/domain/services/stats';
import { applyPhysicalDamage, applyPsychicDamage } from '$lib/domain/services/damage';

export const action = {
  Strike: {
    name: 'ストライク',
    description: 'STRで攻撃',
    log: ({ actor, target }) => {
      if (!target) return '';

      let log;
      if (target.guard) {
        log = `${actor.STR}の力で攻撃！${target.name}は守りの体制を取って、ダメージを半減させた！`;
      } else {
        log = `${target.name}に${actor.STR}の力で攻撃！`;
      }
      return log;
    },
    execute: ({ actor, target }) => {
      if (target) {
        applyPhysicalDamage(actor, target, actor.STR);
      }
    }
  },
  Curse: {
    name: '呪う',
    description: 'POWで攻撃',
    cooldownTurns: 1,
    log: ({ actor, target }) => {
      if (!target) return '';
      return `${actor.POW}の精神力で呪った！${target.name}は${target.POW}÷2の精神力で抵抗した！`;
    },
    execute: ({ actor, target }) => {
      if (target) {
        applyPsychicDamage(actor, target, actor.POW);
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
